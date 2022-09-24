#!/bin/bash
#program: this is a auto-deploy app scripts.
#author: Mr.MarkGuan 
#date: 2020-03-05
#version: v0.0.1

# deploy to gogs
set -e

git add -A
read -p "Please input this version commits: " -t 30 commits
git commit -m "${commits}"
git push origin master

exit 0