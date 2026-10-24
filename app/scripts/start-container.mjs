import {loadSecrets} from './container-secrets.mjs'
loadSecrets(['DB_PASSWORD','METRICS_BEARER_TOKEN'])
await import('../server.js')
