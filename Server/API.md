# API structure

## GEOCODE

```
GET /geocode/<id>
```
Retrieve best coordinates and details about an address or a stop point.

--------

```
FIND /geocode/
``` 
Retrieve multiple coordinates and details about an address or a stop point.

### Params
```ts
id: string                  // [FIND] Identifier to geocode
max: number                 // Max number of results to return
uniqueVoies: boolean        // Filter roads to be unique
```

## Itinerary

```
GET /itinerary/paths
```
Retrieves path between 2 geocoded points using public transportation network.

### Params
```ts
from: string                                                // Source of search
to: string                                                  // Destination of search
transports: Record<"FOOT" | "TBM" | "SNCF", boolean>        // Allowed transports 
departureTime: number                                       // Departure time
maxWalkDistance: number                                     // Maximum distance to walk
walkSpeed: number                                           // Walk speed
waitForUpdate: boolean                                      // Wether to wait for fresh data
```

--------

```
GET /itinerary/foot
```
Retrieves foot path between 2 geocoded points.

### Params
```ts
from: string                                                // Source of search
to: string                                                  // Destination of search
maxWalkDistance: number                                     // Maximum distance to walk
walkSpeed: number                                           // Walk speed
waitForUpdate: boolean                                      // Wether to wait for fresh data
```

## Refresh-data

```
GET /refresh-data/<endpoint>
GET /refresh-data/all
```
Force actualization of data for supplied endpoints, or every endpoints.

### Params
```ts
force: boolean              // Force refresh and ignore cooldowns
waitForUpdate: boolean      // Wait for endpoints to be refreshed
```
