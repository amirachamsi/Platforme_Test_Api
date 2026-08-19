package com.bct.back.DTO;

/**
 * k6's JSON summary (metrics/checks/thresholds) plus the raw console output
 * captured alongside it. The console output carries the BODY_SAMPLE lines
 * logged by testcase-runner.js — a JSON summary alone can't hold those
 * without bloating it, so they travel via stdout and get merged back in by
 * K6ResultParser.
 */
public record K6RunOutput(String summaryJson, String consoleOutput) {
}