#!/bin/bash

set -e
cd "$(dirname "$0")/.."

pnpm bundle

NODE_VERSION="v20.19.2"
PLATFORMS=("darwin-arm64" "darwin-x64" "win-x64")

for PLATFORM in "${PLATFORMS[@]}"; do
  echo "Building for $PLATFORM"
  
  # extract node binary and save with platform name
  NODE_DIST="node-$NODE_VERSION-$PLATFORM"
  [[ "$PLATFORM" == win* ]] && IS_WINDOWS=true || IS_WINDOWS=false
  [[ "$IS_WINDOWS" = true ]] && NODE_ARCHIVE="$NODE_DIST.zip" || NODE_ARCHIVE="$NODE_DIST.tar.gz"
  [[ "$IS_WINDOWS" = true ]] && BIN_NAME="$PLATFORM-bin.exe" || BIN_NAME="$PLATFORM-bin"
  [[ "$IS_WINDOWS" = true ]] && NODE_SRC_PATH="node.exe" || NODE_SRC_PATH="bin/node"
  NODE_URL="https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE"
  NODE_EXTRACT_PATH="./dist/node/$PLATFORM"
  NODE_DST_PATH="./dist/node/$BIN_NAME"
  ARCHIVE_PATH="./dist/node/$NODE_ARCHIVE"

  if [ ! -f "$NODE_DST_PATH" ]; then
    mkdir -p "$NODE_EXTRACT_PATH"
    echo "Node.js binary for $PLATFORM $NODE_VERSION..."
    curl -L -o "$ARCHIVE_PATH" "$NODE_URL"
    if [ "$IS_WINDOWS" = true ]; then
      unzip -j "$ARCHIVE_PATH" "$NODE_DIST/$NODE_SRC_PATH" -d "$NODE_EXTRACT_PATH"
    else
      tar -xzf "$ARCHIVE_PATH" -C "$NODE_EXTRACT_PATH" --strip-components=1
    fi
    cp "$NODE_EXTRACT_PATH/$NODE_SRC_PATH" "$NODE_DST_PATH"
    rm "$ARCHIVE_PATH"
    rm -rf "$NODE_EXTRACT_PATH"
  fi

  # create the actual mcp binary by injecting a blob into node
  # based on https://nodejs.org/download/release/v20.19.2/docs/api/single-executable-applications.html
  OUTPUT_PATH="./dist/mcp8-$BIN_NAME"
  node --experimental-sea-config sea-config.json
  cp "$NODE_DST_PATH" "$OUTPUT_PATH"

  DO_CODESIGN=false
  if [ "$IS_WINDOWS" = false ]; then
    if command -v codesign >/dev/null 2>&1; then
      DO_CODESIGN=true
    else
      echo -e "\033[1;33mWarning: codesign not found, skipping codesign operations.\033[0m"
    fi
  fi

  if [ "$DO_CODESIGN" = true ]; then
      codesign --remove-signature "$OUTPUT_PATH"
  fi

  npx postject "$OUTPUT_PATH" NODE_SEA_BLOB ./dist/sea-prep.blob \
      --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
      --macho-segment-name NODE_SEA

  if [ "$DO_CODESIGN" = true ]; then
      codesign --sign - "$OUTPUT_PATH"
  fi

done

# for backwards compatibility with the kilo prebuild
cp dist/mcp8-darwin-arm64-bin dist/mcp8
