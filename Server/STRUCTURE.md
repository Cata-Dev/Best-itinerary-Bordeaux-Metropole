# App structure

```yml
- app.ts # main app
- channels.ts # realtime channels
- client.ts # typed client for front-end
- configuration.ts
- declarations.ts # app declarations (config, app object...)
- index.ts # entry point
- logger.ts # logging stuff
- mongoose.ts # database stuff
- validators.ts # feathers validation
```

### externalAPIs/
```yml
- index.ts # initialize APIs
- endpoint.ts # Endpoint class
```
### — \<provider\>/
```yml
- index.ts # initialize provider
```
### — — endpoints/
```yml
- <endpoint>.endpoint.ts # collection of endpoints for given provider
```

### hooks/
```yml
- index.ts # some feathers hooks
```

### services/
```yml
- index.ts # initialize services
```
### — \<service\>/
```yml
# feathers CLI structure
- <service>.class.ts
- <service>.schema.ts
- <service>.shared.ts
- <service>.ts
```

### utils/
```yml
- index.ts # some utilities
- TypedEmitter.ts
```
