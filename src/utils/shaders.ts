
export const vertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize( normalMatrix * normal );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

export const fragmentShader = `
varying vec3 vNormal;
void main() {
  float intensity = pow( 0.5 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) ), 6.0 );
  gl_FragColor = vec4( 1.0, 0.7, 0.4, 1.0 ) * intensity + vec4( 1.0, 0.9, 0.8, 1.0 ) * (1.0 - intensity);
}
`;