#![allow(non_snake_case)]
use super::RaptorScanner::SCRaptorScanner;
use super::RouteStructs::*;

use std::collections::HashMap;
use std::fmt::{Debug, Display, Formatter};

use chrono::{DateTime, Utc};

pub enum RaptorError {
    StopNotFound(&'static str),
    InfiniteLabel
}

impl Debug for RaptorError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match *self {
            Self::StopNotFound(text) => {
                write!(f, "NotFoundError: \"{}\"", text)
            },
            Self::InfiniteLabel => {
                write!(f, "Infinite label encountered when determining the best journey from multilabels")
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
            },
            Self::InfiniteLabel => {
                write!(f, "Raptor Algorithm encountered an infinite label")
            }
        }
    }
}

impl std::error::Error for RaptorError {
    fn description(&self) -> &str {
        match *self {
            Self::StopNotFound(_) => "The algorithm wasn't able to found a stop or a route in a Vec (ex: find an equvialent stop index in a route)",
            Self::InfiniteLabel => "Infinite label encountered when determining the best journey from multilabels"
        }
    }
}


pub fn STSCRaptor<'r>(
    stops: &'r Stops,
    departureTime: &'r DateTime<Utc>,
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    maxTransfer: usize
) -> Result<Journey<'r>, RaptorError> {
    let mut scanner: SCRaptorScanner = SCRaptorScanner::new(
        maxTransfer,
        &departureTime,
        &departureStop.id,
        stops,
        targetStop,
    );
    let mut markedStops = vec![departureStop];
    let mut markedRoutes = HashMap::new();
    for k in 1..maxTransfer {
        // Accumulate routes serving marked stops from previous round
        scanner.markRoutes(k, &mut markedRoutes, &mut markedStops);
        // Traverse each Marked Scheduled Route
        scanner.processScheduledRoutes(k, &markedRoutes, &mut markedStops);
        // // Look at non-scheduled routes
        scanner.processNonScheduledRoutes(k, &markedStops);
        // //    Exit condition
        if scanner.isScanCompleted(&markedStops) {
            break;
        }
    }
    scanner.computeBestJourney()
}

// fn MTSCRaptor<'r>() {}
