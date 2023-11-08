#![allow(non_snake_case)]
use std::collections::{HashMap, VecDeque};

use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;

#[derive(PartialEq, Deserialize)]
pub struct Coords {
    x: u32,
    y: u32,
}

#[derive(PartialEq, Deserialize)]
pub struct Stop<'rd> {
    pub id: usize,
    pub name: String,
    pub coords: Coords,
    pub nonScheduledRoutes: Vec<&'rd NonScheduledRoute>,
    pub scheduledRoutes: Vec<&'rd ScheduledRoute>,
}
pub type Stops<'rd> = HashMap<usize, Stop<'rd>>;

#[derive(PartialEq, Deserialize)]
pub struct NonScheduledRoute {
    pub id: usize,
    pub name: String,
    pub targetStop: usize,
    pub transferTime: Duration,
}

#[derive(PartialEq, Deserialize)]
pub struct ScheduledRoute {
    pub id: usize,
    pub name: String,
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
        None
    }
}

#[derive(Clone)]
pub struct MarkedScheduledRoute<'r> {
    pub earliestStop: &'r Stop<'r>,
    pub earliestStopEquivalentIndex: usize,
    pub route: &'r ScheduledRoute,
}

pub enum TripOfJourney<'rd> {
    ScheduledRoute {
        departureStop: &'rd Stop<'rd>,
        arrivalStop: &'rd Stop<'rd>,
        arrivalTime: DateTime<Utc>,
        departureTime: DateTime<Utc>,
        routeId: usize,
    },
    NonScheduledRoute {
        departureStop: &'rd Stop<'rd>,
        arrivalStop: &'rd Stop<'rd>,
        arrivalTime: DateTime<Utc>,
        departureTime: DateTime<Utc>,
        routeId: usize,
    },
}
pub type Journey<'rd> = VecDeque<TripOfJourney<'rd>>;
