<template>
  <v-row justify="center" class="py-1 text-center">
    <v-col cols="10" class="pt-1">
      <logo size="24" />
      <div class="my-1 locked-tips">BPassword未解锁，请先解锁</div>
    </v-col>
  </v-row>
</template>

<script>
import logo from '@/ui/widgets/Logo.vue';
export default {
  name: 'LockedComponent',
  components: {
    logo,
  },
  data() {
    return {};
  },
};
</script>
<style></style>
