use super::RouteStructs::*;
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Duration;
//

#[derive(Clone)]
pub struct CriteriasHolder<'r> {
    //TODO: add diversity
    arrivalTime: &'r Duration, // Less is better
    staticScore: f32, // Greater is better // penibility, landscape beauty, people's kindness on the road :)
}
pub struct CriteriaComparator
// the sum of the factors is equal to 1
{
    deltaArrivalTimeStep: u64, // in seconds
    arrivalTimeFactor: f32,
    staticScoreFactor: f32,
}

impl CriteriaComparator {
    fn determinStaticScore() {
        todo!()
    }
    fn returnBestRefMut<'r>(
        &self,
        left: &'r mut Memorizer<'r>,
        right: &'r mut Memorizer<'r>,
    ) -> &'r mut Memorizer<'r> {
        //TODO: compare function with self factors
        let mut leftScore = 10f32 * self.arrivalTimeFactor;
        let mut rightScore = 10f32 * self.arrivalTimeFactor;
        if left.criteriasHolder.arrivalTime > right.criteriasHolder.arrivalTime {
            leftScore -= (left.criteriasHolder.arrivalTime.as_secs()
                - right.criteriasHolder.arrivalTime.as_secs()) as f32
                / self.deltaArrivalTimeStep as f32;
        } else {
            rightScore -= (left.criteriasHolder.arrivalTime.as_secs()
                - right.criteriasHolder.arrivalTime.as_secs()) as f32
                / self.deltaArrivalTimeStep as f32;
        }
        leftScore += left.criteriasHolder.staticScore * self.staticScoreFactor;
        rightScore += right.criteriasHolder.staticScore * self.staticScoreFactor;
        if leftScore > rightScore {
            left
        } else {
            right
        }
    }
}
#[derive(Clone)]
pub enum UserInfos<'r> {
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
pub struct Memorizer<'r> {
    userInfos: &'r UserInfos<'r>,
    criteriasHolder: CriteriasHolder<'r>,
}
impl<'r> Memorizer<'r> {
    pub fn memorize(
        &mut self,
        arrivalTime: &'r Duration,
        staticScore: f32,
        userInfos: &'r UserInfos<'r>,
    ) {
        self.userInfos = userInfos;
        self.criteriasHolder.arrivalTime = arrivalTime;
        self.criteriasHolder.staticScore = staticScore;
    }
}
#[derive(Clone)]
pub enum MemorizerManagerForOneStop<'r> {
    Single {
        memorizer: Memorizer<'r>,
    },
    Multiple {
        memorizers: Vec<Memorizer<'r>>, // Should be small since we want at best a dozen of possibles itenaries (no need for a HashMap)
        bestIndex: usize,
        worstIndex: usize,
    },
}
impl<'r> MemorizerManagerForOneStop<'r> {}
static INIT_ARRIVAL_TIME: Duration = Duration::from_secs(u64::MAX);
static NONE_DURATION: Duration = Duration::from_secs(0);

pub struct MemorizerManager<'r> {
    // 'rs: raptor scanner | 'rd: raptor datas
    memorizersPerStop: HashMap<usize, MemorizerManagerForOneStop<'r>>,
    maxMemorizersPerStop: usize,
    noneMemorizer: Memorizer<'r>,
    criteriaComparator: &'r CriteriaComparator,
}

impl<'r> MemorizerManager<'r> {
    fn memorizeFor(
        &'r mut self,
        stopId: &'r usize,
        arrivalTime: &'r Duration,
        routeScore: f32,
        userInfos: &'r UserInfos,
    ) {
        match self.memorizersPerStop.get_mut(stopId).unwrap() {
            MemorizerManagerForOneStop::Single { memorizer } => {
                if memorizer.criteriasHolder.staticScore < routeScore {
                    memorizer.memorize(arrivalTime, routeScore, userInfos);
                }
            }
            MemorizerManagerForOneStop::Multiple {
                memorizers,
                bestIndex,
                worstIndex,
            } => {
                memorizers[*worstIndex].memorize(arrivalTime, routeScore, userInfos);
                //TODO: UPDATE WORST INDEX
                let mut chosenMemorizer: &mut Memorizer = &mut self.noneMemorizer;
                for memorizer in memorizers.iter_mut() {
                    chosenMemorizer = self
                        .criteriaComparator
                        .returnBestRefMut(memorizer, chosenMemorizer);
                }
            }
        }
    }
    pub fn getBestEarliestArrivalTime(&self, stopId: &usize) -> &Duration {
        unsafe {
            //100% sure to find the stop, due to structure of the algo
            let stopManager = self.memorizersPerStop.get(stopId).unwrap_unchecked();
            match stopManager {
                MemorizerManagerForOneStop::Single { memorizer } => {
                    memorizer.criteriasHolder.arrivalTime
                }
                MemorizerManagerForOneStop::Multiple {
                    memorizers,
                    bestIndex,
                    worstIndex,
                } => memorizers[*bestIndex].criteriasHolder.arrivalTime,
            }
        }
    }
    pub fn getWorstEarliestArrivalTime(&self, stopId: &usize) -> &Duration {
        unsafe {
            //100% sure to find the stop, due to structure of the algo
            let stopManager = self.memorizersPerStop.get(stopId).unwrap_unchecked();
            match stopManager {
                MemorizerManagerForOneStop::Single { memorizer } => {
                    memorizer.criteriasHolder.arrivalTime
                }
                MemorizerManagerForOneStop::Multiple {
                    memorizers,
                    bestIndex,
                    worstIndex,
                } => memorizers[*worstIndex].criteriasHolder.arrivalTime,
            }
        }
    }
}

pub struct RaptorScanner<'rs, 'rd: 'rs> {
    // 'rs: raptor scanner | 'rd: raptor datas
    memorizerManager: RefCell<MemorizerManager<'rs>>,
    markedStops: RefCell<Vec<&'rd Stop<'rd>>>,
    markedRoutes: RefCell<Vec<MarkedScheduledRoute<'rd>>>,
    stops: &'rd HashMap<usize, Stop<'rd>>,
}
impl<'rs, 'rd: 'rs> RaptorScanner<'rs, 'rd> {
    pub fn new(
        stops: &'rd HashMap<usize, Stop<'rd>>,
        stopsCount: usize,
        maxMemorizersPerStop: usize,
        departureStop: &'rd Stop<'rd>,
        criteriaComparator: &'rd CriteriaComparator,
    ) -> Self {
        if maxMemorizersPerStop == 1 {
            Self {
                memorizerManager: RefCell::new(MemorizerManager {
                    memorizersPerStop: (0..stopsCount)
                        .map(|stopId| {
                            (
                                stopId,
                                MemorizerManagerForOneStop::Single {
                                    memorizer: Memorizer {
                                        userInfos: &UserInfos::Null,
                                        criteriasHolder: CriteriasHolder {
                                            staticScore: 0f32,
                                            arrivalTime: &INIT_ARRIVAL_TIME,
                                        },
                                    },
                                },
                            )
                        })
                        .collect(),
                    maxMemorizersPerStop,
                    noneMemorizer: Memorizer {
                        criteriasHolder: CriteriasHolder {
                            arrivalTime: &NONE_DURATION,
                            staticScore: 0f32,
                        },
                        userInfos: &UserInfos::Null,
                    },
                    criteriaComparator,
                }),
                markedStops: RefCell::new(vec![departureStop]),
                markedRoutes: RefCell::new(vec![]),
                stops,
            }
        } else {
            Self {
                memorizerManager: RefCell::new(MemorizerManager {
                    memorizersPerStop: (0..stopsCount)
                        .map(|stopId| {
                            (
                                stopId,
                                MemorizerManagerForOneStop::Multiple {
                                    memorizers: vec![
                                        Memorizer {
                                            userInfos: &UserInfos::Null,
                                            criteriasHolder: CriteriasHolder {
                                                staticScore: 0f32,
                                                arrivalTime: &INIT_ARRIVAL_TIME,
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
                    noneMemorizer: Memorizer {
                        criteriasHolder: CriteriasHolder {
                            arrivalTime: &NONE_DURATION,
                            staticScore: 0f32,
                        },
                        userInfos: &UserInfos::Null,
                    },
                    criteriaComparator,
                }),
                markedStops: RefCell::new(vec![departureStop]),
                markedRoutes: RefCell::new(vec![]),
                stops,
            }
        }
    }
    pub fn markRoutes(&'rs self) {
        let markedRoutes: &mut Vec<MarkedScheduledRoute<'rd>> = &mut self.markedRoutes.borrow_mut();
        let markedStops = self.markedStops.borrow();
        let memorizerManager = self.memorizerManager.borrow();
        markedRoutes.clear();
        for markedStop in markedStops.iter() {
            for scheduledRoute in markedStop.scheduledRoutes {
                // If there is already this route in the marked route
                if let Some(markedRoute) = markedRoutes
                    .iter_mut()
                    .find(|x| -> bool { x.route.id == scheduledRoute.id })
                {
                    if memorizerManager.getBestEarliestArrivalTime(&markedRoute.earliestStop.id)
                        > memorizerManager.getBestEarliestArrivalTime(&markedStop.id)
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
    }
    fn scanMarkedScheduledRoute(
        &'rs self,
        targetStopId: usize, // target pruning
        markedRoute: &MarkedScheduledRoute<'rs>,
    ) {
        let memorizerManager: &mut MemorizerManager<'rs> = &mut self.memorizerManager.borrow_mut();
        let markedStops: &mut Vec<&'rd Stop<'rd>> = &mut self.markedStops.borrow_mut();

        //TODO: self.markedStops ? one allocation, at the same heap spot
        let mut currentTrip: &[Duration] = &[];
        for &stopId in markedRoute.route.stopsId[markedRoute
            .route
            .getUncheckedEquivalentIndexFor(markedRoute.earliestStop.id)..]
            .iter()
        {
            // TODO: ADD CRITERIA CHECK HERE
            if currentTrip != &[]
                && &currentTrip[stopId]
                    < std::cmp::min(
                        memorizerManager.getWorstEarliestArrivalTime(&stopId),
                        memorizerManager.getWorstEarliestArrivalTime(&targetStopId),
                    )
            {
                markedStops.push(&self.stops[&stopId]);
            }
            //TODO: HANDLE THE CATCHING OF AN EARLIER TRIP
            if memorizerManager.getBestEarliestArrivalTime(&stopId) < &currentTrip[stopId] {
                markedRoute.route.findEarliestTripAt(
                    stopId,
                    memorizerManager.getBestEarliestArrivalTime(&stopId),
                );
            }
        }
    }
    fn scanNonScheduleRoute(&'rs self, markedStop: &'rs Stop<'rd>) {
        let memorizerManager = self.memorizerManager.borrow_mut();
        let markedStops = &mut self.markedStops.borrow_mut();
        for nonScheduledRoute in markedStop.nonScheduledRoutes.iter() {
            let nonScheduledRouteDuration = *(memorizerManager
                .getWorstEarliestArrivalTime(&markedStop.id))
                + nonScheduledRoute.transferTime;
            let targetStopWorstEarliestArrivalTime =
                memorizerManager.getWorstEarliestArrivalTime(&nonScheduledRoute.targetStop.id);
            if targetStopWorstEarliestArrivalTime > &nonScheduledRouteDuration {
                //TODO: Add memorizing + compare worst earliest arrival time ?
            }
        }
    }
    pub fn processScheduledRoutes(&'rs self, targetStopId: usize) {
        for markedRoute in self.markedRoutes.borrow().iter() {
            self.scanMarkedScheduledRoute(targetStopId, markedRoute)
        }
    }
    pub fn processNonScheduledRoutes(&'rs self) {
        for markedStop in self.markedStops.borrow().iter() {
            self.scanNonScheduleRoute(&markedStop);
        }
    }
    pub fn isScanCompleted(&self) -> bool {
        self.markedStops.borrow().len() == 0
    }
}
