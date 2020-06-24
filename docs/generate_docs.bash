#!/usr/bin/env bash
# Generates documentation for FiftyOne.
#
# Usage:
#   bash docs/generate_docs.bash
#
# Copyright 2017-2020, Voxel51, Inc.
# voxel51.com
#


# Show usage information
usage() {
    echo "Usage:  bash $0 [-h] [-c]

Options:
-h      Display this help message.
-c      Perform a clean build (deletes existing build directory).
"
}


# Parse flags
SHOW_HELP=false
CLEAN_BUILD=false
while getopts "hc" FLAG; do
    case "${FLAG}" in
        h) SHOW_HELP=true ;;
        c) CLEAN_BUILD=true ;;
        *) usage ;;
    esac
done
[ ${SHOW_HELP} = true ] && usage && exit 0


set -e
export FIFTYONE_HEADLESS=1
THIS_DIR=$(dirname "$0")


if [[ ${CLEAN_BUILD} = true ]]; then
    echo "**** Deleting existing build directories ****"
    rm -rf "${THIS_DIR}/api"
    rm -rf "${THIS_DIR}/build"
fi


echo "**** Generating documentation ****"

#
# The syntax here is:
#   sphinx-apidoc [OPTIONS] -o <OUTPUT_PATH> <MODULE_PATH> [EXCLUDE_PATTERN, …]
#
cd "${THIS_DIR}/.."
sphinx-apidoc -f --no-toc -o docs/api fiftyone

cd docs
make html
cd ..

echo "**** Documentation complete"
printf "To view the docs, open:\n\ndocs/build/html/index.html\n\n"
