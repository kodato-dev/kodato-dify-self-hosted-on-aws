"""Compare the patched Web image with the pinned upstream image on localhost."""
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

BASELINE = "langgenius/dify-web@sha256:77dab617312a464fec9b412547780f5d85f01c3c136c774dbe19ade10ed03b65"
CANDIDATE = sys.argv[1] if len(sys.argv) > 1 else "dify-web-node-security:1.11.1-node22.23.4"


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def request(base, path):
    try:
        response = urllib.request.urlopen(base + path, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read()


containers = []
try:
    endpoints = []
    for role, image in [("baseline", BASELINE), ("candidate", CANDIDATE)]:
        name = "dify-runtime-test-" + role + "-" + uuid.uuid4().hex[:8]
        containers.append(name)
        docker("run", "-d", "--name", name, "--platform", "linux/amd64",
               "-p", "127.0.0.1::3000", "-e", "HOSTNAME=0.0.0.0", image)
        config = json.loads(docker("inspect", name))[0]
        port = config["NetworkSettings"]["Ports"]["3000/tcp"][0]["HostPort"]
        base = "http://127.0.0.1:" + port
        for attempt in range(60):
            try:
                if request(base, "/signin")[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError(f"{role} did not become ready")
        endpoints.append(base)

    version = docker("exec", containers[1], "node", "--version")
    assert version == "v22.23.4", version
    hashes = [docker("exec", name, "sh", "-c",
                     "find /app/web /pnpm -type f ! -path '*/.next/cache/*' -exec sha256sum {} + | sort")
              for name in containers]
    assert hashes[0] == hashes[1], "Application or PM2 files changed"
    sharp = docker("exec", containers[1], "node", "-e", """
const sharp = require(require.resolve('sharp', {paths: [require.resolve('next')]}));
sharp({create: {width: 8, height: 8, channels: 4, background: 'red'}})
  .resize(4, 4).png().toBuffer({resolveWithObject: true})
  .then(({info}) => { if (info.width !== 4 || info.height !== 4) process.exit(1); console.log(JSON.stringify(info)); })
  .catch(error => { console.error(error); process.exit(1); });
""")
    routes = {}
    for path in ["/", "/signin", "/install", "/apps"]:
        old, new = [request(base, path) for base in endpoints]
        assert old[0] == new[0] == 200, (path, old[0], new[0])
        routes[path] = new[0]
    html = request(endpoints[1], "/signin")[1].decode()
    assets = sorted(set(re.findall(r'(?:src|href)="(/_next/static/[^"?]+)', html)))
    assert assets, "No static assets found in the rendered sign-in page"
    for path in assets[:5]:
        old, new = [request(base, path) for base in endpoints]
        assert old[0] == new[0] == 200 and old[1] == new[1], path
    logs = docker("logs", containers[1])
    assert '"event":"node_runtime","version":"v22.23.4"' in logs
    print(json.dumps({"node": version, "unchanged_files": len(hashes[0].splitlines()),
                      "file_manifest_sha256": hashlib.sha256(hashes[0].encode()).hexdigest(),
                      "native_image_processing": json.loads(sharp), "routes": routes,
                      "identical_static_assets": min(5, len(assets)), "runtime_logged": True}, indent=2))
finally:
    for name in containers:
        subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, check=False)
