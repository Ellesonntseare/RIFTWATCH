"""Combine same-rig Mixamo FBX clips into one browser-ready GLB.

Run with Blender: blender -b --python scripts/import-movement-pack.py -- OUTPUT.glb SKIN_AND_MOVE.fbx OTHER_MOVE.fbx ...
The first FBX supplies the mesh; every input supplies one named animation.
"""

import bpy
from pathlib import Path
import sys


def main():
    try:
        args = sys.argv[sys.argv.index("--") + 1 :]
    except ValueError as error:
        raise SystemExit("Pass -- OUTPUT.glb INPUT.fbx [INPUT.fbx ...]") from error
    if len(args) < 2:
        raise SystemExit("Pass -- OUTPUT.glb INPUT.fbx [INPUT.fbx ...]")
    output = Path(args[0]).resolve()
    inputs = [Path(path).resolve() for path in args[1:]]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    primary = None
    original_bones = None
    for index, path in enumerate(inputs):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=str(path), use_anim=True)
        created = set(bpy.data.objects) - before
        armatures = [obj for obj in created if obj.type == "ARMATURE"]
        if len(armatures) != 1 or not armatures[0].animation_data or not armatures[0].animation_data.action:
            raise ValueError(f"Expected one animated armature in {path}")
        armature = armatures[0]
        bones = {bone.name for bone in armature.data.bones}
        if original_bones is None:
            original_bones = bones
        elif bones != original_bones:
            raise ValueError(f"Different skeleton in {path}; import this character separately")
        action = armature.animation_data.action
        action.name = path.stem
        if index == 0:
            primary = armature
            retained = {obj for obj in created if obj.type in {"ARMATURE", "MESH"}}
        else:
            for obj in created:
                bpy.data.objects.remove(obj, do_unlink=True)
    for obj in bpy.data.objects:
        obj.select_set(obj in retained)
    bpy.context.view_layer.objects.active = primary
    primary.animation_data.action = bpy.data.actions[inputs[0].stem]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_nla_strips=False,
        export_morph=False,
        export_skins=True,
    )
    print(f"Exported {len(inputs)} animations to {output}")


if __name__ == "__main__":
    main()
