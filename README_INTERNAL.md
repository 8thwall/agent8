Branched from [Kilo Code](https://github.com/Kilo-Org/kilocode)

# 8th Wall Orchestrator Extension

Until we set up our own authentication, select Amazon Bedrock under "Providers" and use AWS credentials. 

## Setup

```
pnpm install
git lfs fetch # optional
```

You should _not_ need to `git lfs install`, this is incompatible with husky. The hooks have been manually appended to the files in `/.husky/`.

## Versioning

On any PR, bump the `"version"` number in `src/package.json`. Until GA release, leave the major version at `0`. Minor changes can bump the middle number and reset the third, and patches can bump the third. (e.g. `0.13.9`) It should follow [Semantic Versioning](https://semver.org/) to be VSCode Marketplace compliant.

To build the extension, simply run
```
pnpm build
```

It will place  `8th-wall-agent-#.#.#.vsix` in the root `/bin/` folder. To distribute for internal testing, use the [Agent8 Extnesion](https://drive.google.com/drive/folders/1XnTPZabwOI0yQi-FurulZjeUzp6E2NSd?usp=drive_link) folder on the shared Google Drive. Move the existing build into the `archive folder` and upload the updated vsix.

Auto updates coming soon!

## QA

Until we migrate to self-hosted runners or Jenkins, we are trying to minimize GitHub Actions usage, as it is not free. The QA pipeline is run once a PR is approved. To perform most of the CI steps locally, run `pnpm qa` at the project root.
