#![allow(non_snake_case)]
use super::RaptorAlgorithm::RaptorError;

use super::RouteStructs::*;
use chrono::{DateTime, Duration, Utc};
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Debug, PartialEq)]
pub enum Label<'rd> {
    ScheduledRoute {
        arrivalTime: &'rd DateTime<Utc>,
        departureTime: &'rd DateTime<Utc>, // from the boarding stop
        route: &'rd ScheduledRoute,
        boardingStop: &'rd Stop,
    },
    NonScheduledRoute {
        arrivalTime: DateTime<Utc>,
        route: &'rd NonScheduledRoute,
        boardingStop: &'rd Stop,
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
            Label::Infinite => &DateTime::<Utc>::MAX_UTC,
        }
    }
}
#[derive(Debug)]
pub struct MultiLabels<'rd> {
    pub labels: Vec<Label<'rd>>,
    pub earliestLabel: Label<'rd>, //local pruning
}

#[derive(Debug)]
pub struct MultiLabelsManager<'rd> {
    pub inner: HashMap<usize, MultiLabels<'rd>>,
}
impl<'rd> MultiLabelsManager<'rd> {
    pub fn new(roundsCount: usize, stops: &Stops) -> Self {
        Self {
            inner: stops
                .iter()
                .map(|(id, _stop)| {
                    (id.clone(), {
                        let labels = vec!(Label::Infinite; roundsCount);
                        MultiLabels {
                            labels: labels.clone(),
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

pub struct SCRaptorScanner<'rd> {
    // 'rd: raptor datas
    multiLabelsManager: MultiLabelsManager<'rd>,
    stops: &'rd Stops,
    scheduledRoutes: &'rd ScheduledRoutes,
    targetStop: &'rd Stop,
}

impl<'rd> SCRaptorScanner<'rd> {
    /*
    * Creates a new instance of Single-Criteria Raptor Scanner.
    */
    pub fn new(
        stops: &'rd Stops,
        scheduledRoutes: &'rd ScheduledRoutes,
        roundsCount: usize,
        departureTime: &'rd DateTime<Utc>,
        departureStopId: &usize,
        targetStop: &'rd Stop,
    ) -> Self {
        let mut multiLabels = MultiLabelsManager::new(roundsCount, &stops);
        multiLabels.get_mut(departureStopId).labels[0] = Label::DepartureLabel(departureTime);
        Self {
            stops,
            scheduledRoutes,
            multiLabelsManager: multiLabels,
            targetStop,
        }
    }

    /*
    * For each marked stop, we mark its corresonding route.
    * If there is multiples marked stops attached to the same route, only the earliest is taken.
    */
    pub fn markRoutes(
        &mut self,
        currentRound: usize,
        markedRoutes: &mut HashMap<usize, MarkedScheduledRoute<'rd>>,
        markedStops: &mut Vec<&'rd Stop>,
    ) {
        markedRoutes.clear();
        for markedStop in markedStops.iter() {
            for scheduledRouteId in markedStop.scheduledRoutes.iter() {
                // If there is already this route in the marked route, we check if markedStop's
                // arrival time is earlier than the current markedRoute.earliestStop
                if let Some(markedRoute) = markedRoutes.get_mut(scheduledRouteId) {
                    if self.multiLabelsManager.get(&markedStop.id).labels[currentRound - 1]
                        .getArrivalTime()
                        < self
                            .multiLabelsManager
                            .get(&markedRoute.earliestStop.id)
                            .labels[currentRound - 1]
                            .getArrivalTime()
                    {
                        markedRoute.earliestStop = markedStop;
                    }
                } else {
                    let scheduledRoute = unsafe {
                        self.scheduledRoutes
                            .get(scheduledRouteId)
                            .unwrap_unchecked()
                    };
                    markedRoutes.insert(
                        *scheduledRouteId,
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
        markedStops: &mut Vec<&'rd Stop>,
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
                        self.multiLabelsManager
                            .get(&stopId)
                            .earliestLabel
                            .getArrivalTime(),
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
                    if multiLabels.earliestLabel.getArrivalTime()
                        < multiLabels.labels[currentRound].getArrivalTime()
                    {
                        multiLabels.earliestLabel = multiLabels.labels[currentRound].clone();
                    }
                    markedStops.push(&self.stops[&stopId]);
                }
            }
            //HANDLE THE CATCHING OF AN EARLIER TRIP:
            if let Some(trip) = route.getEarliestTripFor(
                stopIndex,
                self.multiLabelsManager.get(&stopId).labels[currentRound - 1].getArrivalTime(),
            ) {
                possibleTrip = Some(trip);
            }
        }
    }

    pub fn processScheduledRoutes(
        &mut self,
        currentRound: usize,
        markedRoutes: &HashMap<usize, MarkedScheduledRoute<'rd>>,
        markedStops: &mut Vec<&'rd Stop>,
    ) {
        for markedRoute in markedRoutes.clone().values() {
            self.scanMarkedScheduledRoute(currentRound, markedStops, &markedRoute)
        }
    }
    pub fn processNonScheduledRoutes(
        &mut self,
        currentRound: usize,
        markedStops: &mut Vec<&'rd Stop>,
        nonScheduledRouteTravelingSpeed: &NonScheduledRouteTravelingSpeed,
    ) {
        let i: usize = 0;
        while i < markedStops.len() {
            let markedStop = markedStops.get(i).unwrap().clone();
            for nonScheduledRoute in markedStop.nonScheduledRoutes.iter() {
                let pathArrivalTime = *self.multiLabelsManager.get(&markedStop.id).labels
                    [currentRound]
                    .getArrivalTime()
                    + Duration::seconds(
                        (nonScheduledRoute.distance
                            / nonScheduledRouteTravelingSpeed
                                .getTravelingSpeed(&nonScheduledRoute.routeType))
                            as i64,
                    );
                let targetEarliestLabel = self
                    .multiLabelsManager
                    .get(&nonScheduledRoute.targetStop)
                    .earliestLabel
                    .getArrivalTime()
                    .clone();
                let targetStopLabels = &mut self
                    .multiLabelsManager
                    .get_mut(&nonScheduledRoute.targetStop)
                    .labels;
                if targetEarliestLabel > pathArrivalTime {
                    targetStopLabels[currentRound] = Label::NonScheduledRoute {
                        arrivalTime: pathArrivalTime,
                        route: nonScheduledRoute,
                        boardingStop: markedStop,
                    };
                    markedStops.push(&self.stops[&nonScheduledRoute.targetStop]);
                }
            }
        }
    }
    pub fn isScanCompleted(&self, markedStops: &Vec<&'rd Stop>) -> bool {
        markedStops.len() == 0
    }
    pub fn computeBestJourney(&self) -> Result<Journey, RaptorError> {
        let mut journeys: Journey = VecDeque::new();
        let mut currentId = self.targetStop.id;
        let mut finished = false;
        let earliestLabel = &self.multiLabelsManager.get(&currentId).earliestLabel;
        while !finished {
            match earliestLabel {
                Label::ScheduledRoute {
                    arrivalTime,
                    departureTime,
                    route,
                    boardingStop,
                } => {
                    journeys.push_front(TripOfJourney {
                        departureStopId: boardingStop.id,
                        arrivalStopId: currentId,
                        arrivalTime: arrivalTime.timestamp(),
                        departureTime: departureTime.timestamp(),
                        routeId: route.id,
                        tripType: TripType::ScheduledRoute,
                    });
                    currentId = boardingStop.id;
                }
                Label::NonScheduledRoute {
                    arrivalTime,
                    route,
                    boardingStop,
                } => {
                    journeys.push_front(TripOfJourney {
                        departureStopId: boardingStop.id,
                        arrivalStopId: currentId,
                        arrivalTime: arrivalTime.timestamp(),
                        departureTime: arrivalTime.timestamp(),
                        routeId: route.id,
                        tripType: TripType::NonScheduledRoute,
                    });
                    currentId = boardingStop.id;
                }
                Label::DepartureLabel(departureTime) => {
                    journeys[0].departureStopId = currentId;
                    finished = true;
                }
                Label::Infinite => return Err(RaptorError::InfiniteLabel),
            };
        }
        Ok(journeys)
    }
}
