#![allow(non_snake_case)]
use futures::StreamExt;
use lazy_static::lazy_static;
use mongodb::bson;
use mongodb::bson::{doc, from_document, Document};
use mongodb::Cursor;
use mongodb::{options::ClientOptions, Client};
use serde::Deserialize;
use serde_json;
use std::collections::HashMap;
use std::fmt::Debug;
use std::io::Read;
use std::sync::{Arc, PoisonError, RwLockReadGuard, RwLockWriteGuard};
use std::{fs, io};
use thiserror::Error;
use tokio::sync::RwLock;
use tokio::task::JoinError;
use wasm_bindgen::prelude::wasm_bindgen;

// pub mod Raptor;
pub mod WasmRaptor;
pub use WasmRaptor::prelude::*;
use WasmRaptor::RaptorAlgorithm;

#[derive(Deserialize)]
struct DBConfig {
    mongodb: String,
}

lazy_static! {
    static ref RAPTOR_DATA_HOLDER: Arc<RwLock<RaptorDataHolder>> =
        Arc::new(RaptorDataHolder::default().into());
}

#[derive(Debug, Error)]
pub enum BIBMError {
    #[error("Stop not found when updating datas")]
    StopNotFound,
    #[error("{0}")]
    RaptorError(#[from] RaptorError),
    #[error("{0}")]
    MongoError(#[from] mongodb::error::Error),
    #[error("{0}")]
    IOError(#[from] io::Error),
    #[error("{0}")]
    SerdeError(#[from] serde_json::Error),
    #[error("{0}")]
    JoinError(#[from] JoinError),
    #[error("Poisoned reader error")]
    PoisonedReader,
    #[error("Poison writer error")]
    PoisonedWriter,
}
// These types dont implement Send, so we can't keep them inside the error
impl From<PoisonError<RwLockReadGuard<'static, RaptorDataHolder>>> for BIBMError {
    fn from(_value: PoisonError<RwLockReadGuard<'static, RaptorDataHolder>>) -> Self {
        Self::PoisonedReader
    }
}
impl From<PoisonError<RwLockWriteGuard<'static, RaptorDataHolder>>> for BIBMError {
    fn from(_value: PoisonError<RwLockWriteGuard<'static, RaptorDataHolder>>) -> Self {
        Self::PoisonedWriter
    }
}
#[derive(Debug)]
pub struct RaptorDataHolder {
    pub stops: Stops,
    pub scheduledRoutes: ScheduledRoutes,
    pub nonScheduledRoutes: Vec<NonScheduledRoute>,
}

impl Default for RaptorDataHolder {
    fn default() -> Self {
        RaptorDataHolder {
            stops: HashMap::new(),
            scheduledRoutes: HashMap::new(),
            nonScheduledRoutes: Vec::new(),
        }
    }
}

#[derive(Deserialize)]
struct DBNonScheduledRoutes {
    pub id: usize,
    pub paths: Vec<NonScheduledRoute>,
}

#[derive(Deserialize)]
struct DBScheduledRoute {
    #[serde(rename(deserialize = "_id"))]
    pub id: usize,
    pub tripsCount: usize,
    pub stopsCount: usize, //Number of Stops on the ScheduledRoute
    pub stopsTimes: Vec<bson::DateTime>,
    #[serde(rename(deserialize = "stops"))]
    pub stopsId: Vec<usize>, // Vec structured as [stopId1, stopdId2, ...] with stop
                             // ids being in the same order as stopTimes
}

impl From<Document> for DBScheduledRoute {
    fn from(value: Document) -> Self {
        from_document(value).unwrap()
    }
}

impl From<DBScheduledRoute> for ScheduledRoute {
    fn from(value: DBScheduledRoute) -> Self {
        ScheduledRoute {
            id: value.id,
            tripsCount: value.tripsCount,
            stopsCount: value.stopsCount,
            stopsTimes: value.stopsTimes.iter().map(|x| x.to_chrono()).collect(),
            stopsId: value.stopsId,
        }
    }
}

impl From<Document> for DBNonScheduledRoutes {
    fn from(value: Document) -> Self {
        from_document(value).unwrap()
    }
}

pub trait GetId {
    type Id;
    fn getId(&self) -> Self::Id;
}

impl GetId for Stop {
    type Id = usize;
    fn getId(&self) -> Self::Id {
        self.id
    }
}

impl GetId for ScheduledRoute {
    type Id = usize;
    fn getId(&self) -> Self::Id {
        self.id
    }
}

async fn fromCursorToVecUnchecked<'r, T>(cursor: Cursor<Document>) -> Vec<T>
where
    T: From<Document>,
{
        cursor
            .map(|value| T::from(value.unwrap()))
            .collect::<Vec<T>>()
            .await
}

#[wasm_bindgen]
pub struct SCRaptorOptions {
    enableSNCF: bool,
    enableTBM: bool,
    nonScheduledRouteTravelingSpeed: NonScheduledRouteTravelingSpeed,
    maxTransfer: usize,
    enableMultithread: bool,
}

impl Default for SCRaptorOptions {
    fn default() -> Self {
        Self {
            enableSNCF: true,
            enableTBM: true,
            nonScheduledRouteTravelingSpeed: NonScheduledRouteTravelingSpeed {
                walkingSpeed: 5.0,
                v3Speed: 10.0,
            },
            maxTransfer: 5,
            enableMultithread: false,
        }
    }
}
impl SCRaptorOptions {
    fn new(
        enableSNCF: bool,
        enableTBM: bool,
        nonScheduledRouteTravelingSpeed: NonScheduledRouteTravelingSpeed,
        maxTransfer: usize,
        enableMultithread: bool,
    ) -> Self {
        Self {
            enableSNCF,
            enableTBM,
            nonScheduledRouteTravelingSpeed,
            maxTransfer,
            enableMultithread,
        }
    }
    fn withTravelingSpeed(mut self, speed: NonScheduledRouteTravelingSpeed) -> Self {
        self.nonScheduledRouteTravelingSpeed = speed;
        self
    }
    fn withSNCF(mut self, toogle: bool) -> Self {
        self.enableSNCF = toogle;
        self
    }
    fn withTBM(mut self, toogle: bool) -> Self {
        self.enableTBM = toogle;
        self
    }
    fn withMaxTransfer(mut self, maxTransfer: usize) -> Self {
        self.maxTransfer = maxTransfer;
        self
    }
    fn withMultiThreading(mut self, toogle: bool) -> Self {
        self.enableMultithread = toogle;
        self
    }
}
pub enum RaptorCommand {
    RaptorSC(SCRaptorOptions),
    // RaptorMC(MCRaptorOptions),
}

#[wasm_bindgen]
pub struct RaptorManager {
    client: Client,
    commandsQueue: Vec<RaptorCommand>,
    isUpdating: bool,
}

impl RaptorManager {
    pub async fn try_new() -> Result<Self, BIBMError> {
        let mut configStr: String = String::new();
        let mut config =
            fs::File::open("../../Best-itinerary-Bordeaux-Metropole/Server/config/default.json")?;
        config.read_to_string(&mut configStr)?;
        let uri = serde_json::from_str::<DBConfig>(&configStr)?.mongodb;
        let clientOptions = ClientOptions::parse(uri).await?;
        let client = Client::with_options(clientOptions)?;
        Ok(Self {
            client,
            commandsQueue: vec![],
            isUpdating: false,
        })
    }

    async fn getCursorOnScheduledRoutesWith(
        client: Client,
    ) -> Result<Cursor<Document>, mongodb::error::Error> {
        let cursor = client
            .database("bibm")
            .collection::<Document>("tbm_scheduled_routes")
            .aggregate(
                [
                    doc! {
                          "$match": doc! {
                              "trips.0": doc! {
                                  "$exists": true
                              }
                          }
                    },
                    doc! {
                        "$addFields": doc! {
                            "tripsCount": doc! {
                                "$size": "$trips"
                            },
                            "stopsCount": doc! {
                                "$size": "$stops"
                            }
                        }
                    },
                    doc! {
                        "$lookup": doc! {
                            "from": "tbm_schedules",
                            "localField": "trips.schedules",
                            "foreignField": "_id",
                            "as": "stopsTimes"
                        }
                    },
                    doc! {
                        "$set": doc! {
                            "stopsTimes": doc! {
                                "$map": doc! {
                                    "input": "$stopsTimes",
                                    "in": doc! {
                                        "$getField": doc! {
                                            "field": "hor_estime",
                                            "input": "$$this"
                                        }
                                    }
                                }
                            }
                        }
                    },
                ],
                None,
            )
            .await?;
        Ok(cursor)
    }

    async fn updateScheduledRoutesWith(client: Client) -> Result<(), BIBMError> {
        let cursor = Self::getCursorOnScheduledRoutesWith(client).await?;
        let scheduledRoutes: ScheduledRoutes = fromCursorToVecUnchecked::<DBScheduledRoute>(cursor)
            .await
            .into_iter()
            .map(|el| {(el.id, ScheduledRoute::from(el))})
            .collect();
        // Clear all scheduled routes for each stop
        for (_id, stop) in RAPTOR_DATA_HOLDER.write().await.stops.iter_mut() {
            stop.scheduledRoutes.clear();
        }
        // Update scheduled route id for each stop
        for (id, scheduledRoute) in scheduledRoutes.iter() {
            for stopId in scheduledRoute.stopsId.iter() {
                RAPTOR_DATA_HOLDER
                    .write()
                    .await
                    .stops
                    .get_mut(stopId)
                    .ok_or(BIBMError::StopNotFound)?
                    .scheduledRoutes
                    .push(*id);
            }
        }
        RAPTOR_DATA_HOLDER.write().await.scheduledRoutes = scheduledRoutes;
        Ok(())
    }

    pub async fn updateScheduledRoutes(&self) -> Result<(), BIBMError> {
        Self::updateScheduledRoutesWith(self.client.clone()).await
    }

    async fn getCursorOnNonScheduledRoutesWith(
        client: Client,
    ) -> Result<Cursor<Document>, BIBMError> {
        let cursor = client
            .database("bibm")
            .collection::<Document>("non_scheduled_routes")
            .aggregate(
                [doc! {
                    "$group": doc! {
                        "_id": "$from",
                        "paths": doc! {
                            "$push": doc! {
                                "to": "$to",
                                "distance": "$distance"
                            }
                        }
                    }
                }],
                None,
            )
            .await?;
        Ok(cursor)
    }

    async fn updateNonScheduledRoutesWith(client: Client) -> Result<(), BIBMError> {
        let cursor = Self::getCursorOnNonScheduledRoutesWith(client).await?;
        let raptorDataHolder = &mut RAPTOR_DATA_HOLDER.write().await;
        let mut dbNonScheduledRoutes = cursor.map(|doc| unsafe {
            from_document::<DBNonScheduledRoutes>(doc.unwrap_unchecked()).unwrap_unchecked()
        });
        while let Some(dbNonScheduledRoute) = dbNonScheduledRoutes.next().await {
            raptorDataHolder
                .stops
                .get_mut(&dbNonScheduledRoute.id)
                .ok_or(BIBMError::StopNotFound)?
                .nonScheduledRoutes = dbNonScheduledRoute.paths
        }
        Ok(())
    }

    pub async fn updateNonScheduledRoutes(&self) -> Result<(), BIBMError> {
        Self::updateNonScheduledRoutesWith(self.client.clone()).await
    }

    async fn getCursorOnStopsWith(client: Client) -> Result<Cursor<Stop>, BIBMError> {
        let cursor = client
            .clone()
            .database("bibm")
            .collection::<Stop>("tbm_stops")
            .find(None, None)
            .await?;
        Ok(cursor)
    }

    async fn updateStopsWith(client: Client) -> Result<(), BIBMError> {
        let cursor = Self::getCursorOnStopsWith(client).await?;
        let stops: HashMap<usize, Stop> = cursor
            .map(|stop| {
                let stop = stop.unwrap();
                (stop.id, stop)
            })
            .collect()
            .await;
        RAPTOR_DATA_HOLDER.write().await.stops = stops;
        Ok(())
    }

    pub async fn updateStops(&self) -> Result<(), BIBMError> {
        Self::updateStopsWith(self.client.clone()).await
    }

    pub async fn setupRaptorDatas(&self) -> Result<(), BIBMError> {
        Self::updateStopsWith(self.client.clone()).await?;
        tokio::spawn(Self::updateScheduledRoutesWith(self.client.clone())).await??;
        // tokio::spawn(Self::updateNonScheduledRoutesWith(self.client.clone())).await??;
        Ok(())
    }
    pub async fn runSCRaptor(
        &self,
        departureStopId: usize,
        targetStopId: usize,
        departureTime: DateTime<Utc>,
        scRaptorOptions: SCRaptorOptions,
    ) -> Result<Journey, BIBMError> {
        let datas = RAPTOR_DATA_HOLDER.read().await;
        // Todo spawn ??
        Ok(RaptorAlgorithm::STSCRaptor(
            &datas.stops,
            &datas.scheduledRoutes,
            departureStopId,
            departureTime,
            targetStopId,
            scRaptorOptions.nonScheduledRouteTravelingSpeed,
            scRaptorOptions.maxTransfer,
        )?)
    }
}
