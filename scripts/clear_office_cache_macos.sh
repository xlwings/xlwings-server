#!/bin/bash
# To run this script: bash scripts/clear_office_cache_macos.sh
# https://learn.microsoft.com/en-us/office/dev/add-ins/testing/clear-cache

rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Caches/
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Application
rm -rf ~/Library/Containers/com.microsoft.Office365ServiceV2/Data/Caches/com.microsoft.Office365ServiceV2/
rm -rf ~/Library/Containers/com.microsoft.Office365ServiceV2/Data/Library/Caches/com.microsoft.Office365ServiceV2/
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Application\ Support/Microsoft/Office/16.0/Wef/
