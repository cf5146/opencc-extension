import { mount } from 'svelte';

import '@/assets/styles/theme.css';
import '@/assets/styles/options.css';

import App from './App.svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Options root element was not found');
}

mount(App, { target });
