#![allow(non_snake_case)]
use std::collections::VecDeque;

use chrono::{DateTime, Duration, Utc};

#[derive(PartialEq)]
pub struct Coords {
    x: u32,
    y: u32,
}

#[derive(PartialEq)]
pub struct Stop<'r> {
    pub id: usize,
    pub name: String,
    pub coords: Coords,
    pub nonScheduledRoutes: Vec<&'r NonScheduledRoute<'r>>,
    pub scheduledRoutes: Vec<&'r ScheduledRoute>,
}

#[derive(PartialEq, Clone)]
pub enum RouteType {
    SNCF,
    BUS,
    FOOT,
    // V3,
}

#[derive(PartialEq)]
pub struct NonScheduledRoute<'r> {
    pub id: usize,
    pub name: String,
    pub routeType: RouteType,
    pub targetStop: &'r Stop<'r>,
    pub transferTime: Duration,
}

#[derive(PartialEq)]
pub struct ScheduledRoute {
    pub id: usize,
    pub name: String,
    pub routeType: RouteType,
    pub direction: String,
    pub tripsCount: usize,
    pub stopsCount: usize, //Number of Stops on the ScheduledRoute
    pub stopsTimes: Vec<DateTime<Utc>>,
    pub stopsId: Vec<usize>, // Vec structured as [stopId1, stopdId2, ...] with stopd
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
        return None;
    }
}

#[derive(Clone)]
pub struct MarkedScheduledRoute<'r> {
    pub earliestStop: &'r Stop<'r>,
    pub earliestStopEquivalentIndex: usize,
    pub route: &'r ScheduledRoute,
}

pub enum Journey {
    ScheduledRoute {
        stop: usize,
        arrivalTime: DateTime<Utc>,
        departureTime: DateTime<Utc>,
        route: usize,
    },
    NonScheduledRoute {
        stop: usize,
        arrivalTime: DateTime<Utc>,
        route: usize,
    },
    Departure {
        stop: usize,
        departureTime: DateTime<Utc>
    }
}
pub type Journeys = VecDeque<Journey>;
