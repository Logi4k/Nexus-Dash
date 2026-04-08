#!/bin/bash
# Build Nexus Android APK
export ANDROID_HOME=/home/phill/android-sdk
export ANDROID_NDK=/home/phill/android-sdk/ndk/30.0.14904198
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Set up the cmdline tools
mkdir -p $ANDROID_HOME/cmdline-tools
unzip -qo /tmp/cmdline-tools.zip 2>/dev/null
