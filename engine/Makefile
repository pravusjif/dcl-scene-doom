# Builds doomgeneric to plain JavaScript (wasm2js, no WebAssembly) for the Decentraland scene runtime.
#
#   make DG=../../doomgeneric/doomgeneric            # -> ../src/engine/doomgeneric.js
#
# Requires emcc (Homebrew: brew install emscripten). EM_CONFIG may point at a custom config if the Homebrew
# post-install step did not write one.

# Upstream doomgeneric (GPL-2.0-or-later) revision this platform layer and the patched/ files were built against.
DG_COMMIT = dcb7a8dbc7a16ce3dda29382ac9aae9d77d21284
DG ?= ../../doomgeneric/doomgeneric
OUT ?= ../src/engine/doomgeneric.js
OBJDIR = build

CC = emcc
CFLAGS = -O2 -I. -I$(DG) -DNORMALUNIX -DLINUX -D_DEFAULT_SOURCE \
         -DCMAP256 -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 \
         -Wno-everything
LDFLAGS = -O2 -sWASM=0 -sMODULARIZE -sEXPORT_NAME=createDoom -sENVIRONMENT=shell \
          -sINITIAL_MEMORY=67108864 -sSTACK_SIZE=1048576 -sEXIT_RUNTIME=0 -sASSERTIONS=0 \
          -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAPU32 \
          -sMIN_CHROME_VERSION=85

SRC = dummy.c am_map.c doomdef.c doomstat.c dstrings.c d_event.c d_items.c d_iwad.c d_loop.c d_main.c d_mode.c \
      d_net.c f_finale.c f_wipe.c g_game.c hu_lib.c hu_stuff.c info.c i_cdmus.c i_endoom.c i_joystick.c i_scale.c \
      i_sound.c i_system.c i_timer.c memio.c m_argv.c m_bbox.c m_cheat.c m_config.c m_controls.c m_fixed.c m_menu.c \
      m_misc.c m_random.c p_ceilng.c p_doors.c p_enemy.c p_floor.c p_inter.c p_lights.c p_map.c p_maputl.c p_mobj.c \
      p_plats.c p_pspr.c p_saveg.c p_setup.c p_sight.c p_spec.c p_switch.c p_telept.c p_tick.c p_user.c r_bsp.c \
      r_data.c r_draw.c r_main.c r_plane.c r_segs.c r_sky.c r_things.c sha1.c sounds.c statdump.c st_lib.c st_stuff.c \
      s_sound.c tables.c v_video.c wi_stuff.c w_checksum.c w_file.c w_main.c w_wad.c z_zone.c w_file_stdc.c \
      i_input.c i_video.c doomgeneric.c

OBJS = $(addprefix $(OBJDIR)/, $(SRC:.c=.o)) $(OBJDIR)/doomgeneric_dcl.o $(OBJDIR)/dcl_record.o

# Patched renderer files (draw-call recorder hooks) take precedence over the upstream sources.
vpath %.c patched $(DG)

all: $(OUT)

$(OUT): $(OBJS)
	@mkdir -p $(dir $(OUT))
	$(CC) $(LDFLAGS) $(OBJS) -o $(OUT)
	@ls -la $(OUT)

$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(OBJDIR):
	mkdir -p $(OBJDIR)

clean:
	rm -rf $(OBJDIR) $(OUT)

.PHONY: all clean
