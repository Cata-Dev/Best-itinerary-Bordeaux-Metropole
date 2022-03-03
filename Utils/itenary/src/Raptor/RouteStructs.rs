use std::time::Duration;

pub struct Coords {
    x: u32,
    y: u32,
}
pub struct Stop<'r> {
    pub id: usize,
    pub name: String,
    pub coords: Coords,
    pub nonScheduledRoutes: &'r Vec<NonScheduledRoute<'r>>,
    pub scheduledRoutes: &'r Vec<ScheduledRoute<'r>>,
}
pub enum RouteType {
    SNCF,
    BUS,
    FOOT,
    V3,
}
pub struct NonScheduledRoute<'r> {
    //TODO: user route information ? => series of road on wich u will go through
    //TODO: determin if we add the var name to this struct ...
    pub id: usize,
    pub name: String,
    pub routeType: RouteType,
    pub targetStop: &'r Stop<'r>,
    pub distance: u32,
    pub transferTime: Duration,
}
pub struct ScheduledRoute<'r> {
    pub id: usize,
    pub name: String,
    pub routeType: RouteType,
    pub direction: String,
    pub distanceBetweenStops: Vec<u32>,
    pub tripsCount: usize,
    pub stopsCount: usize, //Number of Stops on the ScheduledRoute
    pub stopsTimes: &'r Vec<Duration>,
    pub stopsId: Vec<usize>, //Contains the equivalent stops Ids for stopTimes
}

impl<'r> ScheduledRoute<'r> {
    pub fn findEarliestTripAt(
        &self,
        stopId: usize,
        stopEarliestArrivalTime: Duration,
    ) -> Option<&'r [Duration]> {
        for tripId in 0..self.tripsCount {
            let tripTimetable = self.getTripAt(tripId);
            if stopEarliestArrivalTime < tripTimetable[self.stopsId[stopId] as usize] {
                return Some(&tripTimetable[stopId + 1..]);
            }
        }
        return None;
    }
    //TODO: Bench to know if using hashmap to store (stopId: equivalentStopId) woubd not be better
    pub fn getUncheckedEquivalentIndexFor(&self, stopId: usize) -> usize {
        unsafe {            // due to the structure, we are 100% sure th

            self.stopsId.iter().position(|&id| id == stopId).unwrap_unchecked()
        }
    }

    pub fn getTripAt(self: &Self, tripId: usize) -> &'r [Duration] {
        &self.stopsTimes[tripId * self.stopsCount..tripId * self.stopsCount + self.stopsCount]
    }
}
pub struct MarkedScheduledRoute<'r> {
    pub route: &'r ScheduledRoute<'r>,
    pub earliestStop: &'r Stop<'r>,
}
