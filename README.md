# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Demo:

[Asteroids demo](https://klerith.github.io/claude-asteroids/)

## Descripción del juego

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz...

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción         |
| --------- | -------------- |
| `←` `→`   | Rotar nave     |
| `↑`       | Propulsar      |
| `Espacio` | Disparar       |
| `N`       | Detonar bomba  |

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up de disparo triple: aparece al impactar asteroides, al menos una vez por nivel. Durante 10 segundos la nave se vuelve azul y dispara 3 balas en abanico
- Power-up "Ángel de la guardia": un círculo de energía amarillo rodea la nave durante 5 segundos o hasta absorber el impacto de un asteroide, que se destruye como si le hubieran disparado
- Power-up "Cámara lenta": durante 6 segundos los asteroides se vuelven verdes y se mueven a la mitad de velocidad, mientras la nave mantiene su velocidad normal. Se cancela al perder una vida
- Power-up "Bomba nuclear": ítem escaso (10 % de los power-ups) que se guarda al recogerlo y se detona con `N`. Es de un solo uso y destruye todos los asteroides en pantalla sin dejar fragmentos. Se conserva al perder una vida
