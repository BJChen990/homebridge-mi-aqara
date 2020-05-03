import { MiIODevice } from "../miio/device";

type Status = {
  program: number;
  progress: number;
  volume: number;
  status: 'pause' | 'run';
}
type GetPropFmResponse = {
  current_program: number;
  current_progress: number;
  current_volume: number;
  current_status: 'pause' | 'run';
}

export class FmController {
  constructor(private readonly device: MiIODevice) {}

  play() {
    return this.device.simpleSend('play_fm', ['on']);
  }

  stop() {
    return this.device.simpleSend("play_fm", ["off"]);
  }

  setVolume(volume: number) {
    return this.device.simpleSend("set_fm_volume", [volume]);
  }

  async status(): Promise<Status> {
    const { result } = await this.device.send<[], GetPropFmResponse>("get_prop_fm", []);
    return {
      program: result.current_program,
      volume: result.current_volume,
      progress: result.current_progress,
      status: result.current_status
    }
  }
}