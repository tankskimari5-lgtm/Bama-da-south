# Bama Da South

3D open-world mobile browser life simulator.

## Production site
https://bama-da-south.vercel.app

## Source recovery and safety
The live production game is currently deployed separately to Vercel project `bama-da-south` (deployment `dpl_Hp2r25Af2fMpaizsCJSs2iEXA9i7`). Its production source is a standalone HTML page (~122 KB). The production project's previous GitHub link pointed to `Glitch-Survival-` and should not be used to overwrite this game.

The workflow in `.github/workflows/recover-production.yml` retrieves the HTML being served at the Vercel production alias into `index.html` while checking its title, and commits it to a dedicated `recovered-production` branch. Keep the production deployment unchanged until this recovery is verified.

A standalone trunk-speaker upgrade is being developed separately. Do not deploy a speaker preview page over the existing game.
