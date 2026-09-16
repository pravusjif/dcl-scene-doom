// Draw-call recorder for the Decentraland presenter (option A).
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

#include "dcl_record.h"

#include "doomtype.h"
#include "r_local.h"
#include "r_state.h"

int dcl_records[DCL_MAX_RECORDS * DCL_REC_INTS];
int dcl_record_count = 0;
int dcl_record_overflow = 0;
int dcl_src_kind = 0;
int dcl_src_id = 0;
int dcl_src_col = 0;
int dcl_cur_flat = 0;
int dcl_post_topdelta = 0;
int dcl_masked = 0;

static void (*orig_col)(void);
static void (*orig_fuzz)(void);
static void (*orig_trans)(void);
static void (*orig_span)(void);

static int shade_of(lighttable_t *cm)
{
    if (!cm) return 0;
    int s = (int)(((byte *)cm - (byte *)colormaps) >> 8);
    if (s < 0 || s > 33) s = 0;
    return s;
}

static void rec_col(int type)
{
    if (dc_yh < dc_yl) return;
    if (dcl_record_count >= DCL_MAX_RECORDS) { dcl_record_overflow++; return; }
    int *r = dcl_records + dcl_record_count * DCL_REC_INTS;
    r[0] = type;
    r[1] = dc_x;
    r[2] = dc_yl;
    r[3] = dc_yh;
    r[4] = dcl_src_kind;
    r[5] = dcl_src_id;
    r[6] = dcl_src_col;
    r[7] = dc_texturemid;
    r[8] = dc_iscale;
    r[9] = dcl_post_topdelta;
    r[10] = shade_of(dc_colormap);
    r[11] = dcl_masked;
    dcl_record_count++;
}

static void rec_span(void)
{
    if (ds_x2 < ds_x1) return;
    if (dcl_record_count >= DCL_MAX_RECORDS) { dcl_record_overflow++; return; }
    int *r = dcl_records + dcl_record_count * DCL_REC_INTS;
    r[0] = 3;
    r[1] = ds_x1;
    r[2] = ds_y;
    r[3] = ds_x2;
    r[4] = 2;
    r[5] = dcl_cur_flat;
    r[6] = 0;
    r[7] = ds_xfrac;
    r[8] = ds_yfrac;
    r[9] = ds_xstep;
    r[10] = shade_of(ds_colormap);
    r[11] = ds_ystep;
    dcl_record_count++;
}

static void wrap_col(void)   { rec_col(0); orig_col(); }
static void wrap_fuzz(void)  { rec_col(1); orig_fuzz(); }
static void wrap_trans(void) { rec_col(2); orig_trans(); }
static void wrap_span(void)  { rec_span(); orig_span(); }

void DCL_InstallRecorders(void)
{
    // R_ExecuteSetViewSize has just assigned the plain draw functions; capture them and install the wrappers.
    orig_col = basecolfunc;
    orig_fuzz = fuzzcolfunc;
    orig_trans = transcolfunc;
    orig_span = spanfunc;
    colfunc = basecolfunc = wrap_col;
    fuzzcolfunc = wrap_fuzz;
    transcolfunc = wrap_trans;
    spanfunc = wrap_span;
}

void DCL_ResetRecords(void)
{
    dcl_record_count = 0;
    dcl_record_overflow = 0;
}
