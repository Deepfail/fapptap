import { Command } from "@tauri-apps/plugin-shell";

export async function runStage(
  stage: "beats" | "cutlist" | "render",
  args: any
): Promise<void> {
  switch (stage) {
    case "beats":
      return invokePy("compute_beats.py", {
        audio: args.audio,
        out: "cache/beats.json",
      });
    case "cutlist":
      return invokePy("build_cutlist.py", {
        song: args.song,
        clips: args.clips,
        style: args.style,
        mode: args.cutting_mode,
        out: "cache/cutlist.json",
      });
    case "render":
      return invokeRenderer({ proxy: !!args.proxy });
  }
}

async function invokePy(
  script: string,
  args: Record<string, any>
): Promise<void> {
  const pythonArgs = [
    `worker/${script}`,
    ...Object.entries(args).flatMap(([key, value]) => [
      `--${key}`,
      String(value),
    ]),
  ];

  const command = Command.create("python", pythonArgs);
  await command.execute();
}

async function invokeRenderer(options: { proxy: boolean }): Promise<void> {
  const args = options.proxy ? ["--proxy"] : [];
  const command = Command.create("python", [
    "worker/main.py",
    "render",
    ...args,
  ]);
  await command.execute();
}
