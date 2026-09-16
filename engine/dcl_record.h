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
// The software renderer still draws into the 8-bit framebuffer; in addition every column and span draw is
// appended to dcl_records as a 12-int record so the scene can present the view as textured rectangles.
#ifndef DCL_RECORD_H
#define DCL_RECORD_H

#define DCL_MAX_RECORDS 16384
#define DCL_REC_INTS 12

// Record layout (int32 each):
//  [0] type: 0 column, 1 fuzz column (spectre), 2 translated column, 3 span
//  column: [1] dc_x (view-window column, << detailshift for screen px) [2] dc_yl [3] dc_yh (inclusive rows)
//          [4] source kind: 0 wall texture number, 1 patch lump number [5] id [6] texture column
//          [7] dc_texturemid (16.16) [8] dc_iscale (16.16) [9] post topdelta (masked columns) [10] shade 0..33
//          [11] 1 if drawn through R_DrawMaskedColumn (drawn over floors/walls behind it)
//  span:   [1] ds_x1 [2] ds_y [3] ds_x2 [4] 2 [5] flat index (lump - firstflat) [6] 0
//          [7] ds_xfrac [8] ds_yfrac [9] ds_xstep [10] shade [11] ds_ystep
extern int dcl_records[DCL_MAX_RECORDS * DCL_REC_INTS];
extern int dcl_record_count;
extern int dcl_record_overflow;

// Current source descriptor, set by the patched R_GetColumn / R_DrawVisSprite / R_DrawPlanes.
extern int dcl_src_kind;
extern int dcl_src_id;
extern int dcl_src_col;
extern int dcl_cur_flat;
extern int dcl_post_topdelta;
extern int dcl_masked; // 1 while inside R_DrawMaskedColumn (sprites, masked mid textures)

void DCL_InstallRecorders(void); // called at the end of R_ExecuteSetViewSize
void DCL_ResetRecords(void);

#endif
