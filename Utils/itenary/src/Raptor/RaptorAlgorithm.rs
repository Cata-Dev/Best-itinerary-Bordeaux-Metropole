#![allow(non_snake_case)]
use super::RouteScanner::CriteriaComparator;
use super::RouteScanner::RaptorScanner;
use super::RouteStructs::*;
use std::collections::HashMap;
use std::fmt::{Debug, Display, Formatter};
use std::time::Duration;

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

pub fn singleThreadRaptor<'r>(
    stops: &'r HashMap<usize, Stop<'r>>,
    departureTime: Duration,
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    numberOfItenaries: usize,
    maxTransfer: usize,
    criteriaComparator: &'r CriteriaComparator,
) -> Result<(), RaptorError> {
    let scanner: RaptorScanner = RaptorScanner::new(
        &stops,
        stops.len(),
        numberOfItenaries,
        departureStop,
        criteriaComparator,
    );
    for _ in 1..maxTransfer {
        // Accumulate routes serving marked stops from previous round
        scanner.markRoutes();
        // Traverse each Marked Scheduled Route
        scanner.processScheduledRoutes(targetStop.id);
        // Look at non-scheduled routes
        scanner.processNonScheduledRoutes();
        //    Exit condition
        if scanner.isScanCompleted() {
            break;
        }
    }
    Ok(())
} //TODO: when doing multi-criteria, will post processing needed in order to sort the best route?
  //Return the fastest itinerary
  // the problem is there with there with single itenary but with multiple ?
  // and how do I implement it ? Do I stores as much itenaries, and then sort them (post process ) or
  // do I add something inside of the scan (stop domination)

fn multiThreadRaptor<'r>() {}
async fn asyncRaptor() {}
