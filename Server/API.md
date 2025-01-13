# API structure

## GEOCODE

```
GET /geocode/:id
```

Retrieve best coordinates and details about an address or a stop point.

---

```
FIND /geocode/
```

Retrieve multiple coordinates and details about an address or a stop point.

### Params

```ts
id: string; // [FIND only] Identifier to geocode
max: number = 10; // Max number of results to return
uniqueVoies: boolean = false; // Filter roads to be unique
```

## Itinerary

```
GET /journeys/
```

Retrieves journeys between 2 geocoded points using public transportation network.

### Params

```ts
from: LocationQuery; // Source of search
to: LocationQuery; // Destination of search
transports?: Record<"FOOT" | "TBM" | "SNCF", boolean>; // Allowed transports
departureTime?: number; // Departure time
maxWalkDistance?: number; // Maximum distance to walk
walkSpeed?: number; // Walk speed
// + Refresh-data params, optional
```

With `LocationQuery` :

```ts
id: number;
type: TBMEndpoints.Addresses | TBMEndpoints.Stops | SNCFEndpoints.Stops;
coords: [lat: number, lon: number];
alias: string;
```

---

```
GET /journeys/:oldResultId
```

Retrieves an old journey computation result.
Same return as `/itinerary/paths`.

### Params

None

## Path

```
GET /path/foot
```

Retrieves footpath between 2 geocoded points.

### Params

```ts
from: string; // Source of search
to: string; // Destination of search
realShape: boolean; // Get real shape of path (following geographical structure)
```

---

```
FIND /path/journey
```

Retrieves footpaths included in a previously computed journey.

### Params

```ts
for: "journey";
id: string; // id of previously computed journey
index: number; // index of journey in computed journeys
```

## Refresh-data

```
GET /refresh-data/<endpoint>
GET /refresh-data/all
```

Force actualization of data for supplied endpoints, or every endpoints.

### Params

```ts
force: boolean; // Force refresh and ignore cooldowns
waitForUpdate: boolean; // Wait for endpoints to be refreshed
```
