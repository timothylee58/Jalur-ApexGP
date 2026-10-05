<script setup lang="ts">
import AccuracyBoard from "./AccuracyBoard.vue";

const LIVE = "https://jalur-apexgp-backend.vercel.app/api/accuracy/weekend";
const SNAPSHOT = `${import.meta.env.BASE_URL}weekend.json`;

// ?offline skips the network and shows the saved weekend.
const offline = new URLSearchParams(location.search).has("offline");
</script>

<template>
  <main class="page">
    <AccuracyBoard :endpoint="offline ? SNAPSHOT : LIVE" :snapshot="SNAPSHOT" />
  </main>
</template>

<style>
body { margin: 0; background: #05060a; }
.page { padding: 1.5rem 1rem; }
</style>
