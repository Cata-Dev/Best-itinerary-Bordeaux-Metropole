#![allow(non_snake_case)]
use std::collections::{HashMap, VecDeque};
use std::vec::Vec;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(PartialEq, Deserialize, Debug)]
pub struct Coords {
    x: f32,
    y: f32,
}

#[derive(PartialEq, Deserialize, Debug)]
pub struct Stop {
    #[serde(rename(deserialize = "_id"))]
    pub id: usize,
    pub coords: Coords,
    #[serde(skip)]
    pub nonScheduledRoutes: Vec<NonScheduledRoute>,
    #[serde(skip)]
    pub scheduledRoutes: Vec<usize>,
}
pub type Stops = HashMap<usize, Stop>;

#[derive(PartialEq, Deserialize, Default, Debug)]
pub enum NonScheduledRouteType {
    #[default]
    Walk,
    V3,
}

#[wasm_bindgen]
pub struct NonScheduledRouteTravelingSpeed {
    pub walkingSpeed: f32,
    pub v3Speed: f32,
}
impl NonScheduledRouteTravelingSpeed {
    pub fn getTravelingSpeed(&self, routeType: &NonScheduledRouteType) -> f32 {
        match routeType {
            NonScheduledRouteType::Walk => self.walkingSpeed,
            NonScheduledRouteType::V3 => self.v3Speed,
        }
    }
}

#[derive(PartialEq, Deserialize, Debug)]
pub struct NonScheduledRoute {
    #[serde(rename(deserialize = "_id"))]
    pub id: usize,
    pub routeType: NonScheduledRouteType,
    pub targetStop: usize,
    pub distance: f32,
}

#[derive(PartialEq, Deserialize, Default, Debug)]
pub struct ScheduledRoute {
    pub id: usize,
    pub tripsCount: usize,
    pub stopsCount: usize, //Number of Stops on the ScheduledRoute
    pub stopsTimes: Vec<DateTime<Utc>>,
    pub stopsId: Vec<usize>, // Vec structured as [stopId1, stopdId2, ...] with stop
                             // ids being in the same order as stopTimes
}

impl<'rd> ScheduledRoute {
    pub fn getEquivalentStopId(&self, stopId: &usize) -> usize {
        unsafe {
            self.stopsId
                .iter()
                .position(|id| id == stopId)
                .unwrap_unchecked()
        }
    }
    pub fn getTripAt(&'rd self, tripId: usize) -> &'rd [DateTime<Utc>] {
        &self.stopsTimes[tripId * self.stopsCount..tripId * self.stopsCount + self.stopsCount]
    }

    pub fn getStopTimeOn(
        &'rd self,
        tripId: usize,
        stopEquivalentIndex: usize,
    ) -> &'rd DateTime<Utc> {
        println!("Yo");
        let mut acc = 0;
        for i in 0..self.tripsCount {
            acc += self.getTripAt(tripId).len();
        }
        println!(
            "Acc vs stopsCount: {:?} vs {:?}",
            acc,
            self.stopsCount * self.tripsCount
        );
        println!(
            "Current trip, number of stops : {:?}",
            self.getTripAt(tripId).len()
        );
        println!("Trips count {:?}", self.tripsCount);
        println!("Trip Id {:?}", tripId);
        println!("Stops Count{:?}", self.stopsCount);
        println!("Stops ids {:?}", self.stopsId.len());
        println!("Stop equ {:?}", stopEquivalentIndex);
        println!(
            "Result : {:?}",
            tripId * self.stopsCount + stopEquivalentIndex
        );
        &self.stopsTimes[tripId * self.stopsCount + stopEquivalentIndex]
    }

    pub fn getEarliestTripFor(
        &'rd self,
        stopEquivalentIndex: usize,
        stopArrivalTime: &DateTime<Utc>,
    ) -> Option<&'rd [DateTime<Utc>]> {
        for tripId in 0..self.tripsCount {
            if stopArrivalTime < self.getStopTimeOn(tripId, stopEquivalentIndex) {
                let tripTimetable = self.getTripAt(tripId);
                return Some(&tripTimetable[stopEquivalentIndex + 1..]);
            }
        }
        return None;
    }
}
pub type ScheduledRoutes = HashMap<usize, ScheduledRoute>;

#[derive(Clone, Debug)]
pub struct MarkedScheduledRoute<'r> {
    pub earliestStop: &'r Stop,
    pub earliestStopEquivalentIndex: usize,
    pub route: &'r ScheduledRoute,
}
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub enum TripType {
    ScheduledRoute = 0,
    NonScheduledRoute = 1,
    Departure = 2,
}

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct TripOfJourney {
    pub tripType: TripType,
    pub departureStopId: usize,
    pub arrivalStopId: usize,
    pub routeId: usize,
    pub arrivalTime: i64,
    pub departureTime: i64,
}
pub type Journey = VecDeque<TripOfJourney>;
