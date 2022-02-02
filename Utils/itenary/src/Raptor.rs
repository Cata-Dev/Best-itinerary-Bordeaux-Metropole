#![allow(non_snake_case)]
use std::time::Duration;
use std::vec::Vec;

// enum RouteInfo {
// TBM { id: u32 },
// SNCF { id: u32 },
// FOOT { id: u32 },
// }
//
// impl RouteInfo {
// fn getId(&self) -> u32 {
// match *self {
// Self::TBM { id } => id,
// Self::SNCF { id } => id,
// Self::FOOT { id } => id,
// }
// }
// }
//
// impl PartialEq for RouteInfo {
// fn eq(&self, other: &Self) -> bool {
// self.getId() == other.getId()
// }
// }

pub struct Coords {
    x: u32,
    y: u32,
}

struct FootPath<'r> {
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    transferTime: Duration,
}
pub struct Stop<'r> {
    id: usize,
    name: String,
    footPaths: &'r Vec<FootPath<'r>>,
    routesServed: &'r Vec<Route<'r>>,
    arrivalTimes: Vec<Duration>,
}

pub struct Route<'r> {
    id: usize,
    tripsCount: usize,
    stopsCount: usize, //Number of Stops on the route
    stopsTimes: &'r Vec<Duration>,
}
impl<'r> Route<'r> {
    fn findEarliestStopReachable(&self, stopTimetable: &[Duration]) -> Option<&'r [Duration]> {
        for tripId in 0..self.tripsCount {
            let tripTimetable = self.getTripAt(tripId);
            for stopId in 0..self.stopsCount {
                if tripTimetable[stopId] >= stopTimetable[stopId] {
                    return Some(&tripTimetable[stopId + 1..]);
                }
            }
        }
        return None;
    }
}
impl<'r> Route<'r> {
    fn getTripAt(self: &Self, id: usize) -> &'r [Duration] {
        &self.stopsTimes[id * self.stopsCount..id * self.tripsCount + self.stopsCount]
    }
}

impl<'r> PartialEq for Route<'r> {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

struct RaptorDatas<'r> {
    routes: Vec<Route<'r>>,
    stops: Vec<Stop<'r>>,
    footPaths: Vec<FootPath<'r>>,
    stopTimes: Vec<Duration>,
    footPathsPerStop: Vec<&'r Vec<FootPath<'r>>>,
    stopsPerRoute: Vec<&'r Vec<Stop<'r>>>,
    routesPerStop: Vec<&'r Vec<Route<'r>>>,
}

fn findNearestStops<'r>(coords: Coords, maxDistance: u32) {}

struct MarkedRoute<'r> {
    routeId: usize,
    earliestStop: &'r Stop<'r>,
}

fn raptor<'r>(
    raptorDatas: &RaptorDatas<'r>,
    departureTime: Duration,
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    maxTransfer: usize,
) {
    let mut markedStops: Vec<&Stop> = vec![];
    let mut markedRoutes: Vec<MarkedRoute> = vec![];
    let mut earliestArrivalTimePerStop: Vec<Duration> = Vec::new();
    let mut earliestArrivalTimePerRoute: Vec<Duration> = Vec::new();
    earliestArrivalTimePerStop.reserve(raptorDatas.stops.len());
    earliestArrivalTimePerRoute.reserve(raptorDatas.routes.len());

    for k in 1..maxTransfer {
        // Accumulate routes serving marked stops from previous round
        markedRoutes.clear();
        for markedStop in markedStops.iter() {
            for routeServed in markedStop.routesServed {
                // If there is already this route in the marked route
                if let Some(markedRoute) = markedRoutes
                    .iter_mut()
                    .find(|x| -> bool { x.routeId == routeServed.id })
                {
                    if earliestArrivalTimePerRoute[markedRoute.earliestStop.id] > earliestArrivalTimePerRoute[markedStop.id]
                    {
                        markedRoute.earliestStop = markedStop;
                    }
                } else {
                    markedRoutes.push(MarkedRoute {
                        routeId: routeServed.id,
                        earliestStop: markedStop,
                    });
                }
            }
        }
        // Traverse each Route
        for markedRoute in markedRoutes.iter() {}
    
        // Look at foot-path
        for markedStop in markedStops.iter() {
            for footPath in markedStop.footPaths.iter() {
                earliestArrivalTimePerStop[footPath.departureStop.id] = std::cmp::min(
                    earliestArrivalTimePerStop[footPath.departureStop.id] + footPath.transferTime,
                    earliestArrivalTimePerStop[footPath.targetStop.id],
                )
            }
        }
        // Exit condition
        if markedStops.is_empty() {
            break;
        }
    }
}
