use std::vec::Vec;
use std::time::Duration;

enum RouteInfo {
    TBM { id: u32, departueStopId },
    SNCF { id: u32 }, 
    FOOT { }
}

pub struct Coords {
    x: u32, 
    y: u32
}

struct Transfer<'r> {
    targetStop: &'r Stop<'r>, 
    transferTime: Duration,
}

pub struct Stop<'r> {
    name: String,
    routesServed : &'r Vec<Route<'r>>,
    transfers: Vec<Transfer<'r>>, 
    earliestArrivalTime: Duration, 
    arrivalTimes: Vec<Duration>
}
pub struct StopTimes<'r> {
    stop: &'r Stop<'r>, 
    arrivalTimes: Vec<u32> 
}

impl<'r> StopTimes<'r> {
    fn getTripAt(index: u32){
        
    }
}

pub struct Route<'r> {       
    tripsCount: u32, 
    stopsCount: u32, //Number of Stops on the route
    earliestStop: &'r Stop<'r>,
    stopsTimes: &'r Vec<StopTimes<'r>>,
    stops: &'r Vec<Stop<'r>>,
    routeInfo: RouteInfo, 
}
struct RaptorDatas<'r> {
    stopTimes: Vec<StopTimes<'r>>,
    routeStops: Vec<&'r Stop<'r>>,
    routes: Vec<Route<'r>>, 
    stops : Vec<Stop<'r>>
}
fn findNearestStops<'r> (coords: Coords, maxDistance: u32) -> Vec<Stop<'r>> {
    vec![]
}

fn findEarliestStop<'r> (stops: &'r Vec<Stop<'r>>) -> &'r Stop<'r>{
    stops.iter().min_by_key(|stop| stop.earliestArrivalTime).unwrap()
}

fn getTrip(index: u32) {

}


fn raptor<'r>(raptorDatas: &RaptorDatas, departureTime: Duration, departureStop: &Stop<'r>, target: &Stop<'r>){
    let mut markedStops: Vec<&Stop<'r>> = vec![departureStop];
    let mut markedRoutes: Vec<&Route<'r>> = vec![];

    for k in 1..6 {
        // Accumulate routes serving marked stops from previous round
        markedRoutes.clear();
        for markedStop in markedStops.iter_mut() {
            for routeServed in markedStop.routesServed.iter() {
                routeServed.earliestStop = findEarliestStop(routeServed.stops);
                markedRoutes.push(routeServed);
            }
        }
        // Traverse each Route
        for route in markedRoutes.iter() {
            for i in 0..route.tripsCount {
                
            }
        }
        if markedStops.is_empty() {
            break;
        }
    }
}










