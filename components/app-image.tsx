import NextImage, { type ImageProps } from "next/image";

const tmdbImagePrefix = "https://image.tmdb.org/t/p/";

export default function AppImage(props: ImageProps) {
  const isTmdbArtwork = typeof props.src === "string" && props.src.startsWith(tmdbImagePrefix);
  return <NextImage {...props} unoptimized={props.unoptimized ?? isTmdbArtwork} />;
}
