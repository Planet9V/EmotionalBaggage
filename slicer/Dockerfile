# The slicer service: OrcaSlicer (a separate program, AGPL-3.0, never linked into the app) behind a small HTTP wrapper.
# Pinned: the AppImage is checked against a SHA-256 and the profile tree against a commit, so a build that gets different bytes fails.
# To move to a newer OrcaSlicer, change the four ARGs, run `python3 slicer/tools/gen_profiles.py <profiles> > slicer/profiles.json`, and run the tests.
#
# Two architectures, each with its own official asset and its own pinned checksum: OrcaSlicer 2.5.0 publishes an x86-64
# AppImage and an aarch64 one (OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V2.5.0.AppImage). Docker picks the image's
# architecture (TARGETARCH), so Apple-silicon Macs build the arm64 image natively. The aarch64 checksum is of the release
# asset as downloaded on 21 Nov 2026; the arm64 image has not been run on an Apple-silicon Mac yet.
FROM ubuntu:24.04

ARG TARGETARCH
ARG ORCA_VERSION=2.5.0
ARG ORCA_TAG=v2.5.0
ARG ORCA_COMMIT=40ecc66f78ed72dc368e0c1ebe40d77f00cc8a19
ARG ORCA_APPIMAGE_SHA256=d13eb0a9cd618ed080ab6b82c64c0a60c4501aac91e88d5ac2c3b526fb141a7c
ARG ORCA_APPIMAGE_ARM64_SHA256=00a4fa0a2f9c1649abb8c438b0537ed1e58fed5206faa560c1c0fb4ab225f9cf

# The 2.5.0 AppImage does not bundle WebKitGTK; the command line slices without a display but the binary still links it.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 python3-venv \
      libwebkit2gtk-4.1-0 libgtk-3-0t64 libgl1 libegl1 libopengl0 libgbm1 libsecret-1-0 libxkbcommon0 \
      libfontconfig1 fonts-dejavu-core xvfb xauth \
 && rm -rf /var/lib/apt/lists/*

# OrcaSlicer: the official release asset, extracted (no FUSE in a container).
RUN mkdir -p /opt/orca-dl /opt \
 && case "${TARGETARCH:-amd64}" in \
      amd64) ASSET="OrcaSlicer_Linux_AppImage_Ubuntu2404_V${ORCA_VERSION}.AppImage"; SUM="${ORCA_APPIMAGE_SHA256}" ;; \
      arm64) ASSET="OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V${ORCA_VERSION}.AppImage"; SUM="${ORCA_APPIMAGE_ARM64_SHA256}" ;; \
      *) echo "No OrcaSlicer ${ORCA_VERSION} build for ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /opt/orca-dl/orca.AppImage "https://github.com/OrcaSlicer/OrcaSlicer/releases/download/${ORCA_TAG}/${ASSET}" \
 && echo "${SUM}  /opt/orca-dl/orca.AppImage" | sha256sum -c - \
 && chmod +x /opt/orca-dl/orca.AppImage \
 && cd /opt/orca-dl && ./orca.AppImage --appimage-extract >/dev/null \
 && mv squashfs-root /opt/orca && cd / && rm -rf /opt/orca-dl

# The profile source tree at the same tag. 2.5.0 ships its profiles as packed .opc files; the command line resolves a preset file
# through its vendor folder and the sibling <vendor>.json, so the source tree is the form it needs.
RUN git clone -q --depth 1 --branch "${ORCA_TAG}" --filter=blob:none --sparse https://github.com/OrcaSlicer/OrcaSlicer /opt/orca-src \
 && cd /opt/orca-src && git sparse-checkout set resources/profiles \
 && test "$(git rev-parse HEAD)" = "${ORCA_COMMIT}" \
 && mv resources/profiles /opt/orca/profiles-src && cd / && rm -rf /opt/orca-src \
 && ln -s /opt/orca/profiles-src /opt/orca/profiles \
 # The extracted AppImage keeps its owner-only folder modes; the service runs as another user and must read them.
 && chmod -R a+rX /opt/orca

RUN python3 -m venv /opt/venv
COPY requirements.txt /srv/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /srv/requirements.txt
WORKDIR /srv
COPY app ./app
COPY profiles.json ./profiles.json
COPY tests ./tests
COPY tools ./tools

RUN useradd --create-home --uid 10001 slicer && mkdir -p /var/slicer && chown slicer /var/slicer
USER slicer
ENV ORCA_BIN=/opt/orca/AppRun \
    ORCA_PROFILES=/opt/orca/profiles \
    ORCA_VERSION=${ORCA_VERSION} \
    SLICER_WORKDIR=/var/slicer \
    LC_ALL=C \
    PATH=/opt/venv/bin:$PATH
EXPOSE 8000
# HOST and PORT can be set by the host platform, as in the planner image. A platform whose private network is IPv6 (Railway) needs HOST=::
ENV HOST=0.0.0.0 PORT=8000
HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD python3 -c "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT', '8000'), timeout=4).status == 200 else 1)"
CMD ["sh", "-c", "exec uvicorn app.main:app --host \"$HOST\" --port \"$PORT\""]
