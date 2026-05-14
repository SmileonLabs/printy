FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ARG VERAPDF_INSTALLER_URL=https://software.verapdf.org/releases/verapdf-installer.zip
ARG BASICCOLOR_ICC_URL=https://downloads.sourceforge.net/project/openicc/basICColor-Profiles/icc-profiles-basiccolor-printing2009-1.2.0.tar.bz2?download
ARG BASICCOLOR_ICC_SHA256=0d1ab5cb8a72ab76a02c67f07708e94a5794397eeac0acdb7503e2c11b515707
ARG GOWUN_DODUM_FONT_URL=https://raw.githubusercontent.com/google/fonts/main/ofl/gowundodum/GowunDodum-Regular.ttf
ARG GOWUN_DODUM_FONT_SHA256=a6e457933227483a11758fd0947bc74422a106d46f0bf057fdaa5af94a30067d

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PRINTY_GHOSTSCRIPT_PATH=/usr/bin/gs
ENV PRINTY_QPDF_PATH=/usr/bin/qpdf
ENV PRINTY_CMYK_ICC_PATH=/opt/printy/color/ISOcoated_v2_bas.ICC
ENV PRINTY_CHROMIUM_PATH=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fontconfig \
    ghostscript \
    openjdk-17-jre-headless \
    qpdf \
    bzip2 \
    unzip \
    wget \
    fonts-nanum \
    fonts-noto-cjk \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data/uploads/generated-logos /app/data/uploads/brand-assets /app/data/uploads/admin/brand-mockup-templates /app/public/uploads/admin/business-card-backgrounds /opt/printy/color

RUN mkdir -p /usr/share/fonts/truetype/printy \
  && wget -O /usr/share/fonts/truetype/printy/GowunDodum-Regular.ttf "$GOWUN_DODUM_FONT_URL" \
  && printf '%s  %s\n' "$GOWUN_DODUM_FONT_SHA256" /usr/share/fonts/truetype/printy/GowunDodum-Regular.ttf | sha256sum -c - \
  && fc-cache -f

RUN wget -O /tmp/basiccolor-icc.tar.bz2 "$BASICCOLOR_ICC_URL" \
  && printf '%s  %s\n' "$BASICCOLOR_ICC_SHA256" /tmp/basiccolor-icc.tar.bz2 | sha256sum -c - \
  && mkdir -p /tmp/basiccolor-icc \
  && tar -xjf /tmp/basiccolor-icc.tar.bz2 -C /tmp/basiccolor-icc --strip-components=1 \
  && cp /tmp/basiccolor-icc/default_profiles/printing/ISOcoated_v2_bas.ICC /opt/printy/color/ISOcoated_v2_bas.ICC \
  && cp /tmp/basiccolor-icc/default_profiles/printing/LICENSE-ZLIB-bICC /opt/printy/color/LICENSE-ZLIB-bICC \
  && rm -rf /tmp/basiccolor-icc /tmp/basiccolor-icc.tar.bz2

COPY ops/verapdf/docker-install.xml /tmp/verapdf-docker-install.xml

RUN wget -O /tmp/verapdf-installer.zip "$VERAPDF_INSTALLER_URL" \
  && mkdir -p /tmp/verapdf-installer \
  && unzip -q /tmp/verapdf-installer.zip -d /tmp/verapdf-installer \
  && verapdf_installer_jar="$(find /tmp/verapdf-installer -name 'verapdf-izpack-installer-*.jar' -print -quit)" \
  && test -n "$verapdf_installer_jar" \
  && java -jar "$verapdf_installer_jar" /tmp/verapdf-docker-install.xml \
  && ln -s /opt/verapdf/verapdf /usr/local/bin/verapdf \
  && verapdf --help >/dev/null \
  && rm -rf /tmp/verapdf-installer /tmp/verapdf-installer.zip /tmp/verapdf-docker-install.xml

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY db ./db
COPY scripts ./scripts

RUN mkdir -p /app/data/uploads/generated-logos /app/data/uploads/brand-assets /app/data/uploads/admin/brand-mockup-templates /app/public/uploads/admin/business-card-backgrounds /app/.next/cache /opt/printy/color \
  && chown -R node:node /app/data /app/public/uploads/admin/business-card-backgrounds /app/.next

USER node

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
