use super::RaptorAlgorithm::RaptorError;
use super::RouteStructs::*;
use std::cmp::{Ordering, PartialEq, PartialOrd};
use std::collections::HashMap;
use std::time::Duration;
//
#[derive(Clone)]
struct CriteriasManager<'r> {
    //TODO: add diversity
    staticScore: u32,          // Greater is better
    arrivalTime: &'r Duration, // penibility, landscape beauty, people's kindness on the road :)
}
impl<'r> CriteriasManager<'r> {
    fn getArrivalTime(&self) -> &'r Duration {
        self.arrivalTime
    }
}
impl<'r> PartialEq for CriteriasManager<'r> {
    fn eq(&self, other: &Self) -> bool {
        if self.arrivalTime == other.arrivalTime {
            true
        } else {
            false
        }
    }
}
impl<'r> PartialOrd for CriteriasManager<'r> {
    //score method for the added criteria ?
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        if self.gt(other) {
            Some(Ordering::Greater)
        } else if self.eq(other) {
            Some(Ordering::Equal)
        } else {
            Some(Ordering::Less)
        }
    }
    fn gt(&self, other: &Self) -> bool {
        if self.arrivalTime < other.arrivalTime {
            true
        } else {
            false
        }
    }
}

#[derive(Clone)]
enum MemorizerForUserInfos<'r> {
    ScheduledRoute {
        boardingStop: &'r MemorizerManagerForOneStop<'r>,
        route: &'r ScheduledRoute<'r>,
        stop: &'r Stop<'r>,
    },
    NonScheduledRoute {
        boardingStop: &'r MemorizerManagerForOneStop<'r>,
        route: &'r NonScheduledRoute<'r>,
        stop: &'r Stop<'r>,
    },
    Null,
}
#[derive(Clone)]
struct Memorizer<'r> {
    userInfos: MemorizerForUserInfos<'r>,
    criteriasManager: CriteriasManager<'r>,
}
#[derive(Clone)]
enum MemorizerManagerForOneStop<'r> {
    Single {
        memorizer: Memorizer<'r>,
    },
    Multiple {
        memorizers: Vec<Memorizer<'r>>, // Should be small since we want at best a dozen of possibles itenaries (no need for a HashMap)
        bestIndex: usize,
        worstIndex: usize,
    },
}

pub struct Scanner<'r> {
    memorizersPerStop: HashMap<usize, MemorizerManagerForOneStop<'r>>,
    maxMemorizersPerStop: usize,
}
impl<'r> Scanner<'r> {
    pub fn new(
        stopsCount: usize,
        maxMemorizersPerStop: usize,
        initArrivalTime: &'r Duration,
    ) -> Self {
        if maxMemorizersPerStop == 1 {
            Scanner {
                memorizersPerStop: (0..stopsCount)
                    .map(|stopId| {
                        (
                            stopId,
                            MemorizerManagerForOneStop::Single {
                                memorizer: Memorizer {
                                    userInfos: MemorizerForUserInfos::Null,
                                    criteriasManager: CriteriasManager {
                                        staticScore: 0,
                                        arrivalTime: initArrivalTime,
                                    },
                                },
                            },
                        )
                    })
                    .collect(),
                maxMemorizersPerStop,
            }
        } else {
            Scanner {
                memorizersPerStop: (0..stopsCount)
                    .map(|stopId| {
                        (
                            stopId,
                            MemorizerManagerForOneStop::Multiple {
                                memorizers: vec![
                                    Memorizer {
                                        userInfos: MemorizerForUserInfos::Null,
                                        criteriasManager: CriteriasManager {
                                            staticScore: 0,
                                            arrivalTime: initArrivalTime,
                                        }
                                    };
                                    maxMemorizersPerStop
                                ],
                                bestIndex: 0,
                                worstIndex: 0,
                            },
                        )
                    })
                    .collect(),
                maxMemorizersPerStop,
            }
        }
    }
    pub fn scanScheduledRoute(
        &mut self,
        targetStopId: usize, // target prunings
        markedRoute: &'r MarkedScheduledRoute<'r>,
        stop: &'r Stop<'r>,
    ) -> Result<(), RaptorError> {
        let mut currentTrip: &[Duration] = &[];

        for &stopId in markedRoute.route.stopsId[markedRoute
            .route
            .getUncheckedEquivalentIndexFor(markedRoute.earliestStop.id)..]
            .iter()
        {
            // TODO: ADD CRITERIA CHECK HERE
            if currentTrip != &[]
                && currentTrip[stopId]
                    < std::cmp::min(
                        *self.getWorstEarliestArrivalTime(&stopId),
                        *self.getWorstEarliestArrivalTime(&targetStopId),
                    )
            {
                let stopManager = self.memorizersPerStop.get_mut(&stop.id).unwrap(); //TODO: Think about this implementation
                match stopManager {
                    MemorizerManagerForOneStop::Single { memorizer } => {
                        memorizer.criteriasManager.arrivalTime = &currentTrip[stopId];
                    }
                    MemorizerManagerForOneStop::Multiple {
                        memorizers,
                        bestIndex,
                        worstIndex,
                    } => {
                        //TODO: HANDLE THE CHOICE OF THE MEMORIZER WE ARE OVERWRITTING
                        let chosenMemorizerIndex = 0;
                        memorizers[0].criteriasManager.arrivalTime = &currentTrip[stopId]; 
                    }
                }
                //TODO: HANDLE THE MARKING OF Pi
            }
            //TODO: HANDLE THE CATCHING OF AN EARLIER TRIP
        }
        Ok(())
    }
    pub fn scanNonScheduleRoute(&self, markedStop: &Stop, targetStop: &Stop) {
        for nonScheduledRoute in markedStop.nonScheduledRoutes.iter() {
            let nonScheduledRouteDuration = &(*self.getWorstEarliestArrivalTime(&markedStop.id)
                + *(&nonScheduledRoute.transferTime));
            let targetStopWorstEarliestArrivalTime = self.getWorstEarliestArrivalTime(&nonScheduledRoute.targetStop.id);
            if targetStopWorstEarliestArrivalTime
            > nonScheduledRouteDuration
            {   
                //TODO: Add memorizing + compare worst earliest arrival time ?
            }
        }
    }
    pub fn getBestEarliestArrivalTime(&self, stopId: &usize) -> &Duration {
        unsafe {
            //100% sure to find the stop, due to structure of the algo
            let stopManager = self.memorizersPerStop.get(stopId).unwrap_unchecked();
            match stopManager {
                MemorizerManagerForOneStop::Single { memorizer } => {
                    memorizer.criteriasManager.arrivalTime
                }
                MemorizerManagerForOneStop::Multiple {
                    memorizers,
                    bestIndex,
                    worstIndex,
                } => memorizers[*bestIndex].criteriasManager.arrivalTime,
            }
        }
    }
    pub fn getWorstEarliestArrivalTime(&self, stopId: &usize) -> &Duration {
        unsafe {
            //100% sure to find the stop, due to structure of the algo
            let stopManager = self.memorizersPerStop.get(stopId).unwrap_unchecked();
            match stopManager {
                MemorizerManagerForOneStop::Single { memorizer } => {
                    memorizer.criteriasManager.arrivalTime
                }
                MemorizerManagerForOneStop::Multiple {
                    memorizers,
                    bestIndex,
                    worstIndex,
                } => memorizers[*worstIndex].criteriasManager.arrivalTime,
            }
        }
    }
}
