#![allow(non_snake_case)]
use crate::RaptorAlgorithm::RaptorError;

use super::RouteStructs::*;
use chrono::{DateTime, Utc, MAX_DATETIME};
use std::collections::{HashMap, VecDeque};

#[derive(Clone, PartialEq)]
pub enum Label<'rd> {
    ScheduledRoute {
        arrivalTime: &'rd DateTime<Utc>,
        departureTime: &'rd DateTime<Utc>, // from the boarding stop
        route: &'rd ScheduledRoute,
        boardingStop: &'rd Stop<'rd>,
    },
    NonScheduledRoute {
        arrivalTime: DateTime<Utc>,
        route: &'rd NonScheduledRoute<'rd>,
        boardingStop: &'rd Stop<'rd>,
    },
    DepartureLabel(&'rd DateTime<Utc>),
    Infinite,
}
impl<'rd> Label<'rd> {
    fn getArrivalTime(&self) -> &DateTime<Utc> {
        match self {
            Label::ScheduledRoute { arrivalTime, .. } => arrivalTime,
            Label::NonScheduledRoute { arrivalTime, .. } => arrivalTime,
            Label::DepartureLabel(departureTime) => departureTime,
            Label::Infinite => &MAX_DATETIME,
        }
    }
}
pub struct MultiLabels<'rd> {
    pub labels: Vec<Label<'rd>>,
    pub earliestLabel: Label<'rd>, //local pruning
}

pub struct MultiLabelsManager<'rd> {
    pub inner: HashMap<usize, MultiLabels<'rd>>,
}
impl<'rd> MultiLabelsManager<'rd> {
    pub fn new(roundsCount: usize, stopsCount: usize) -> Self {
        Self {
            inner: (0..stopsCount)
                .map(|id| {
                    (id, {
                        let mut labels = vec![Label::Infinite];
                        labels.reserve(roundsCount - 1);
                        MultiLabels {
                            labels,
                            earliestLabel: Label::Infinite,
                        }
                    })
                })
                .collect(),
        }
    }
    pub fn get(&self, stopId: &usize) -> &MultiLabels<'rd> {
        // safe since each multilabel per stop is initialized with the MultiLabel::Infinite
        unsafe { self.inner.get(stopId).unwrap_unchecked() }
    }

    pub fn get_mut(&mut self, stopId: &usize) -> &mut MultiLabels<'rd> {
        // safe since each multilabel per stop is initialized with the MultiLabel::Infinite
        unsafe { self.inner.get_mut(stopId).unwrap_unchecked() }
    }
}

pub struct RaptorScannerSC<'rd> {
    // 'rd: raptor datas
    multiLabelsManager: MultiLabelsManager<'rd>,
    stops: &'rd HashMap<usize, Stop<'rd>>,
    targetStop: &'rd Stop<'rd>,
}

impl<'rd> RaptorScannerSC<'rd> {
    pub fn new(
        roundsCount: usize,
        departureTime: &'rd DateTime<Utc>,
        departureStopId: &usize,
        stops: &'rd HashMap<usize, Stop<'rd>>,
        targetStop: &'rd Stop<'rd>,
    ) -> Self {
        let mut multiLabels = MultiLabelsManager::new(roundsCount, stops.len());
        multiLabels.get_mut(departureStopId).labels[0] = Label::DepartureLabel(departureTime);
        Self {
            stops,
            multiLabelsManager: multiLabels,
            targetStop,
        }
    }

    pub fn markRoutes(
        &mut self,
        currentRound: usize,
        markedRoutes: &mut HashMap<usize, MarkedScheduledRoute<'rd>>,
        markedStops: &mut Vec<&'rd Stop<'rd>>,
    ) {
        markedRoutes.clear();
        for markedStop in markedStops.iter() {
            for scheduledRoute in markedStop.scheduledRoutes.iter() {
                // If there is already this route in the marked route
                if let Some(markedRoute) = markedRoutes.get_mut(&scheduledRoute.id) {
                    if self.multiLabelsManager.get(&markedStop.id).labels[currentRound - 1]
                        .getArrivalTime()
                        < self.multiLabelsManager.get(&markedRoute.earliestStop.id).labels
                            [currentRound - 1]
                            .getArrivalTime()
                    {
                        markedRoute.earliestStop = markedStop;
                    }
                } else {
                    markedRoutes.insert(
                        scheduledRoute.id,
                        MarkedScheduledRoute {
                            route: scheduledRoute,
                            earliestStop: markedStop,
                            earliestStopEquivalentIndex: scheduledRoute
                                .getEquivalentStopId(&markedStop.id),
                        },
                    );
                }
            }
        }
        markedStops.clear();
    }

    fn scanMarkedScheduledRoute(
        &mut self,
        currentRound: usize,
        markedStops: &mut Vec<&'rd Stop<'rd>>,
        markedRoute: &MarkedScheduledRoute<'rd>,
    ) {
        //TODO: self.markedStops ? one allocation, at the same heap spot
        let route = markedRoute.route;
        let mut possibleTrip = route.getEarliestTripFor(
            markedRoute.earliestStopEquivalentIndex,
            self.multiLabelsManager
                .get(&markedRoute.earliestStop.id)
                .earliestLabel
                .getArrivalTime(),
        );
        for (stopIndex, &stopId) in route.stopsId[markedRoute.earliestStopEquivalentIndex..]
            .iter()
            .enumerate()
        {
            if let Some(currentTrip) = possibleTrip {
                if &currentTrip[stopIndex]
                    < std::cmp::min(
                        self.multiLabelsManager //Target pruning
                            .get(&self.targetStop.id)
                            .earliestLabel
                            .getArrivalTime(),
                        self.multiLabelsManager.get(&stopId).earliestLabel.getArrivalTime(),
                    )
                {
                    let multiLabels = self.multiLabelsManager.get_mut(&stopId);
                    multiLabels.labels[currentRound] = Label::ScheduledRoute {
                        arrivalTime: &currentTrip[stopIndex],
                        departureTime: &currentTrip[stopIndex],
                        route,
                        boardingStop: markedRoute.earliestStop,
                    };
                    // Local pruning
                    if multiLabels.earliestLabel.getArrivalTime() < multiLabels.labels[currentRound].getArrivalTime() {
                        multiLabels.earliestLabel = multiLabels.labels[currentRound].clone();
                    }
                    markedStops.push(&self.stops[&stopId]);
                }
            }
            //HANDLE THE CATCHING OF AN EARLIER TRIP:
            if let Some(trip) = route.getEarliestTripFor(
                stopIndex,
                self.multiLabelsManager.get(&stopIndex).labels[currentRound - 1].getArrivalTime(),
            ) {
                possibleTrip = Some(trip);
            }
        }
    }

    fn scanNonScheduleRoute(&mut self, currentRound: usize, markedStop: &'rd Stop<'rd>) {
        for nonScheduledRoute in markedStop.nonScheduledRoutes.iter() {
            let pathArrivalTime = *self.multiLabelsManager.get(&markedStop.id).labels[currentRound]
                .getArrivalTime()
                + nonScheduledRoute.transferTime;
            let targetStopLabels = &mut self
                .multiLabelsManager
                .get_mut(&nonScheduledRoute.targetStop.id)
                .labels;
            if targetStopLabels[currentRound].getArrivalTime() > &pathArrivalTime {
                targetStopLabels[currentRound] = Label::NonScheduledRoute {
                    arrivalTime: pathArrivalTime,
                    route: nonScheduledRoute,
                    boardingStop: markedStop,
                };
            }
        }
    }

    pub fn processScheduledRoutes(
        &mut self,
        currentRound: usize,
        markedRoutes: &HashMap<usize, MarkedScheduledRoute<'rd>>,
        markedStops: &mut Vec<&'rd Stop<'rd>>,
    ) {
        for markedRoute in markedRoutes.clone().values() {
            self.scanMarkedScheduledRoute(currentRound, markedStops, &markedRoute)
        }
    }
    pub fn processNonScheduledRoutes(
        &mut self,
        currentRound: usize,
        markedStops: &Vec<&'rd Stop<'rd>>,
    ) {
        for markedStop in markedStops.iter() {
            self.scanNonScheduleRoute(currentRound, &markedStop);
        }
    }
    pub fn isScanCompleted(&self, markedStops: &Vec<&'rd Stop<'rd>>) -> bool {
        markedStops.len() == 0
    }
    pub fn computeBestJourney(&self) -> Result<Journeys, RaptorError> {
        let mut journeys: Journeys = VecDeque::new();
        let mut currentId = self.targetStop.id;
        let mut finished = false;
        let earliestLabel = &self.multiLabelsManager.get(&currentId).earliestLabel;
        while !finished {
            journeys.push_front(match earliestLabel {
                Label::ScheduledRoute {
                    arrivalTime,
                    departureTime,
                    route,
                    boardingStop,
                } => {
                    currentId = boardingStop.id;
                    Journey::ScheduledRoute {
                        stopId: currentId,
                        arrivalTime: *(arrivalTime).clone(),
                        departureTime: *(departureTime).clone(),
                        route: route.id,
                    }
                }
                Label::NonScheduledRoute {
                    arrivalTime,
                    route,
                    boardingStop,
                } => {
                    currentId = boardingStop.id;
                    Journey::NonScheduledRoute {
                        stopId: currentId,
                        arrivalTime: arrivalTime.clone(),
                        route: route.id,
                    }
                }
                Label::DepartureLabel(departureTime) => {
                    finished = true;
                    Journey::Departure {
                        stopId: currentId,
                        departureTime: *(departureTime).clone(),
                    }
                }
                Label::Infinite => return Err(RaptorError::InfiniteLabel),
            });
        }
        Ok(journeys)
    }
}
