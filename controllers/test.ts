import { FmController } from "./lumi_gateway_fm_controller";
import { MiIODevice } from "../miio/device";
import { MiIOClient } from "../miio/client";
import { wait } from "../utils/promise_utils";

(async () => {
  const controller = new FmController(
    new MiIODevice(
      new MiIOClient(),
      "f971a966298489a44e26058334e75b66",
      "192.168.8.177",
      54321,
    )
  );

  await controller.play();
  await wait(5000);
  console.log(await controller.status());
  await controller.stop();
  await wait(5000);
  console.log(await controller.status());
})();