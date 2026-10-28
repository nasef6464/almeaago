import {useEffect,useState} from 'react';
import {api} from './api';
import type {HomepageSettings} from './homepage-types';
export const HOMEPAGE_SETTINGS_UPDATED='homepage-settings-updated';
// Each mounted consumer owns its request; saved events invalidate all older reads.
export function useHomepageSettings(){const [settings,setSettings]=useState<Partial<HomepageSettings>>({});useEffect(()=>{let cancelled=false;let revision=0;const receive=(event:Event)=>{revision++;setSettings((event as CustomEvent<HomepageSettings>).detail);};window.addEventListener(HOMEPAGE_SETTINGS_UPDATED,receive);const started=revision;api.getHomepageSettings().then(value=>{if(!cancelled&&started===revision)setSettings(value)}).catch(()=>{});return()=>{cancelled=true;window.removeEventListener(HOMEPAGE_SETTINGS_UPDATED,receive);};},[]);return settings;}
