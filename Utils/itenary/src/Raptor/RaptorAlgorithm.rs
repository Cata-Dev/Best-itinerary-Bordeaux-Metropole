#![allow(non_snake_case)]

use std::collections::HashMap;
use std::fmt::{Debug, Display, Formatter};
use std::iter::Scan;
use std::time::Duration;
use std::vec::Vec;

use super::RouteStructs::*;
use super::RouteScanner::Scanner;
//TODO: Implements RaptorError
pub enum RaptorError {
    StopNotFound(&'static str),
}

impl Debug for RaptorError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match *self {
            Self::StopNotFound(text) => {
                write!(f, "NotFoundError: \"{}\"", text)
            }
        }
    }
}

impl Display for RaptorError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match *self {
            Self::StopNotFound(text) => {
                write!(
                    f,
                    "Raptor Algorithm encountered a Not Found Error:\"{}\"",
                    text
                )
            }
        }
    }
}

impl std::error::Error for RaptorError {
    fn description(&self) -> &str {
        match *self {
            Self::StopNotFound(_) => "The algorithm wasn't able to found a stop or a route in a Vec (ex: find an equvialent stop index in a route)",

        }
    }
}
pub struct RaptorDatas<'r> {
    scheduledRoutes: HashMap<usize, ScheduledRoute<'r>>,
    nonScheduledRoutes: HashMap<usize, NonScheduledRoute<'r>>,
    stops: HashMap<usize, Stop<'r>>,
}


//TODO: Bench vec<MarkedRoute> vs hashmap<MakredRoute>
// Return the fastest itinerary
pub fn singleThreadRaptor<'r>(
    raptorDatas: &RaptorDatas<'r>,
    departureTime: Duration,
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    numberOfItenaries: usize,
    maxTransfer: usize,
) -> Result<(), RaptorError> {
    let markedStops: Vec<&Stop> = vec![departureStop];
    let mut markedRoutes: Vec<MarkedScheduledRoute> = vec![];
    let initArrivalTime = Duration::from_secs(u64::MAX);
    let mut scanner: Scanner = Scanner::new(raptorDatas.stops.len(), numberOfItenaries, &initArrivalTime);

    for k in 1..maxTransfer {
        // Accumulate routes serving marked stops from previous round
        markedRoutes.clear();
        for markedStop in markedStops.iter() {
            for scheduledRoute in markedStop.scheduledRoutes   {
                // If there is already this route in the marked route
                if let Some(markedRoute) = markedRoutes
                    .iter_mut()
                    .find(|x| -> bool { x.route.id == scheduledRoute.id })
                {
                    if scanner.getBestEarliestArrivalTime(&markedRoute.earliestStop.id)
                        > scanner.getBestEarliestArrivalTime(&markedStop.id)
                    {
                        markedRoute.earliestStop = markedStop;
                    }
                } else {
                    markedRoutes.push(MarkedScheduledRoute {
                        route: scheduledRoute,
                        earliestStop: markedStop,
                    });
                }
            }
        }
        let mut currentTrip: Option<&[Duration]>;
        // Traverse each Scheduled Route
        for markedRoute in markedRoutes.iter() {

        }

        // Look at non-scheduled routes
        for markedStop in markedStops.iter() {
           
        }
        // Exit condition
        if markedStops.is_empty() {
            break;
        }
    }
    Ok(())
}
