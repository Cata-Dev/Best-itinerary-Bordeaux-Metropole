#![allow(non_snake_case)]
use super::RouteScanner::RaptorScannerSC;
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

struct SCRaptorOptions {
    enableSNCF: bool, 
    enableTBM: bool,
    walkSpeed: u16, 
    maxTransfer: usize,
    enableMultithread: bool,
}
impl Default for SCRaptorOptions {
    fn default() -> Self {
        Self { enableSNCF: true, enableTBM: true, walkSpeed: 5, maxTransfer: 5, enableMultithread: false }
    }
}
impl SCRaptorOptions {
    fn new(enableSNCF: bool, enableTBM: bool, walkSpeed: u16, maxTransfer: usize, enableMultithread: bool) -> Self{
        Self {
            enableSNCF, enableTBM, walkSpeed, maxTransfer, enableMultithread
        }
    }
    fn withWalkingSpeed(self, speed: u16) -> Self {
        self.walkSpeed = speed;
        self
    }
    fn withSNCF(self, toogle: bool) -> Self{
        self.enableSNCF = toogle;
        self
    }
    fn withTBM(self, toogle: bool) -> Self {
        self.enableTBM = toogle;
        self
    }
    fn withMaxTransfer(self, maxTransfer: usize) -> Self {
        self.maxTransfer = maxTransfer;
        self
    }
    fn withMultiThreading(self, toogle: bool) -> Self { 
        self.enableMultithread = toogle;
        self
    }
}

pub fn SCRaptor<'r>(
    stops: &'r HashMap<usize, Stop<'r>>,
    departureTime: DateTime<Utc>,
    departureStop: &'r Stop<'r>,
    targetStop: &'r Stop<'r>,
    options: SCRaptorOptions,
) -> Result<Journeys, RaptorError> {
    let mut scanner: RaptorScannerSC = RaptorScannerSC::new(
        options.maxTransfer,
        &departureTime,
        &departureStop.id,
        stops,
        targetStop,
    );
    let mut markedStops = vec![departureStop];
    let mut markedRoutes = HashMap::new();
    for k in 1..options.maxTransfer {
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
