{ pkgs }: {
	deps = [
		pkgs.nano
  pkgs.gh
  pkgs.nodejs-16_x
        pkgs.nodePackages.typescript-language-server
        pkgs.nodePackages.npm
	];
}
