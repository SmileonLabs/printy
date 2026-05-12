# Printy Color Profiles

The Docker image includes `ISOcoated_v2_bas.ICC` from the basICColor/OpenICC printing profiles as the default CMYK profile at `/opt/printy/color/ISOcoated_v2_bas.ICC`.

Source: `icc-profiles-basiccolor-printing2009-1.2.0.tar.bz2` from OpenICC/basICColor. The archive checksum is pinned in the Dockerfile, and the included `LICENSE-ZLIB-bICC` is copied into the image.

Place print-shop-specific override CMYK ICC profiles here for local Docker smoke checks. This directory is mounted at `/opt/printy/color-overrides`, so set `PRINTY_CMYK_ICC_PATH=/opt/printy/color-overrides/<profile>.icc` when overriding the image default.

Do not commit commercial or licensed ICC profile files unless their license explicitly allows redistribution.
