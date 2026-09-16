// doomgeneric platform layer for the Decentraland scene runtime.
//
// Copyright(C) 2026 the dcl-scene-doom contributors
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// There is no window, no clock and no input device here: the scene's TypeScript drives everything through the
// dg_dcl_* exports below, once per scene tick, and reads the 320x200 8-bit framebuffer + palette straight out of
// the module heap. Built with -DCMAP256 -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 so DG_ScreenBuffer is a
// plain copy of I_VideoBuffer (palette indices) and no RGB conversion happens in C.

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#include "doomgeneric.h"
#include "doomkeys.h"
#include "d_event.h"
#include "i_video.h"
#include "r_local.h"
#include "r_state.h"
#include "doomstat.h"
#include "m_menu.h"
#include "am_map.h"
#include "dcl_record.h"
#include "r_sky.h"

extern int numtextures;
extern int numflats;

#define KEYQUEUE_SIZE 64

static unsigned short s_KeyQueue[KEYQUEUE_SIZE];
static unsigned int s_KeyQueueWrite = 0;
static unsigned int s_KeyQueueRead = 0;
static uint32_t s_TicksMs = 0;
static int s_FrameReady = 0;

// ---- doomgeneric platform hooks ----

void DG_Init(void) {}

void DG_DrawFrame(void) { s_FrameReady = 1; }

// TryRunTics busy-waits with I_Sleep(1) until the clock crosses the next 35 Hz tic boundary. The clock is
// simulated (set from the scene tick), so sleeping must advance it or the wait never ends. The scene reads the
// nudged clock back with dg_dcl_get_time and never sets it backwards, so time stays monotonic and at most one tic
// ahead of real time.
void DG_SleepMs(uint32_t ms) { s_TicksMs += ms; }

uint32_t DG_GetTicksMs(void) { return s_TicksMs; }

int DG_GetKey(int *pressed, unsigned char *doomKey)
{
    if (s_KeyQueueRead == s_KeyQueueWrite) return 0;
    unsigned short data = s_KeyQueue[s_KeyQueueRead];
    s_KeyQueueRead = (s_KeyQueueRead + 1) % KEYQUEUE_SIZE;
    *pressed = data >> 8;
    *doomKey = data & 0xFF;
    return 1;
}

void DG_SetWindowTitle(const char *title) { (void)title; }

// ---- exports driven from TypeScript ----

// Monotonic: a value below the current (possibly sleep-nudged) clock is ignored.
EMSCRIPTEN_KEEPALIVE void dg_dcl_set_time(uint32_t ms) { if (ms > s_TicksMs) s_TicksMs = ms; }
EMSCRIPTEN_KEEPALIVE uint32_t dg_dcl_get_time(void) { return s_TicksMs; }

EMSCRIPTEN_KEEPALIVE void dg_dcl_init(void)
{
    static char *argv[] = { "doom", "-iwad", "/doom1.wad", NULL };
    doomgeneric_Create(3, argv);
}

// Runs TryRunTics (catches up on 35 Hz tics from s_TicksMs) and renders one frame. Returns 1 when a new frame
// was drawn into DG_ScreenBuffer since the previous call.
EMSCRIPTEN_KEEPALIVE int dg_dcl_tick(void)
{
    s_FrameReady = 0;
    DCL_ResetRecords();
    doomgeneric_Tick();
    return s_FrameReady;
}

// ---- draw-call records for the textured presenter (option A) ----

EMSCRIPTEN_KEEPALIVE int *dg_dcl_records(void) { return dcl_records; }
EMSCRIPTEN_KEEPALIVE int dg_dcl_record_count(void) { return dcl_record_count; }
EMSCRIPTEN_KEEPALIVE int dg_dcl_record_overflow(void) { return dcl_record_overflow; }

// DOOM's detail level: 0 = 320 columns, 1 = low detail (160 columns, each drawn 2 px wide). Halves the number of
// wall/sprite records at no cost to vertical resolution. Applied by R_ExecuteSetViewSize on the next frame.
extern int screenblocks;
extern void R_SetViewSize(int blocks, int detail);
EMSCRIPTEN_KEEPALIVE void dg_dcl_set_detail(int detail) { R_SetViewSize(screenblocks, detail ? 1 : 0); }

// View/game state needed to place records on screen and to decide between the textured view and the pixel grid.
EMSCRIPTEN_KEEPALIVE int dg_dcl_view(int what)
{
    switch (what)
    {
        case 0: return viewwindowx;
        case 1: return viewwindowy;
        case 2: return scaledviewwidth;
        case 3: return viewheight;
        case 4: return detailshift;
        case 5: return centery;
        case 6: return menuactive ? 1 : 0;
        case 7: return automapactive ? 1 : 0;
        case 8: return (int)gamestate;
        case 9: return numtextures;
        case 10: return numflats;
        case 11: return firstspritelump;
        case 12: return skytexture;
        default: return 0;
    }
}

// key: doomkeys.h code (KEY_UPARROW, KEY_FIRE, ... or an ASCII char). pressed: 1 down, 0 up.
EMSCRIPTEN_KEEPALIVE void dg_dcl_key(int pressed, int key)
{
    unsigned int next = (s_KeyQueueWrite + 1) % KEYQUEUE_SIZE;
    if (next == s_KeyQueueRead) return; // queue full, drop
    s_KeyQueue[s_KeyQueueWrite] = (unsigned short)(((pressed ? 1 : 0) << 8) | (key & 0xFF));
    s_KeyQueueWrite = next;
}

// Mouse look/turn. buttons: bit0 fire, bit1 strafe, bit2 forward. dx/dy: DOOM mouse units (already accelerated).
EMSCRIPTEN_KEEPALIVE void dg_dcl_mouse(int buttons, int dx, int dy)
{
    event_t ev;
    memset(&ev, 0, sizeof ev);
    ev.type = ev_mouse;
    ev.data1 = buttons;
    ev.data2 = dx;
    ev.data3 = dy;
    D_PostEvent(&ev);
}

EMSCRIPTEN_KEEPALIVE uint8_t *dg_dcl_framebuffer(void) { return (uint8_t *)DG_ScreenBuffer; }

EMSCRIPTEN_KEEPALIVE int dg_dcl_width(void) { return DOOMGENERIC_RESX; }
EMSCRIPTEN_KEEPALIVE int dg_dcl_height(void) { return DOOMGENERIC_RESY; }

// 256 entries of struct color { b, g, r, a } (one uint32 each, little-endian byte order b,g,r,a).
EMSCRIPTEN_KEEPALIVE uint8_t *dg_dcl_palette(void) { return (uint8_t *)colors; }

EMSCRIPTEN_KEEPALIVE int dg_dcl_palette_changed(void)
{
    int changed = palette_changed ? 1 : 0;
    palette_changed = 0;
    return changed;
}
