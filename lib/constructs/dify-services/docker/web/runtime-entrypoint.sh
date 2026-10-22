#!/bin/sh
set -e
node -e 'console.log(JSON.stringify({event:"node_runtime",version:process.version,execPath:process.execPath}))'
exec /bin/sh ./entrypoint.sh
