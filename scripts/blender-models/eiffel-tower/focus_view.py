import bpy

names = ['Eiffel Tower - Iron Lattice', 'Eiffel Tower - Decks', 'Eiffel Tower - Footings']
bpy.ops.object.select_all(action='DESELECT')
for n in names:
    bpy.data.objects[n].select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects['Eiffel Tower - Iron Lattice']

screen = bpy.context.screen
for area in screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
        for region in area.regions:
            if region.type == 'WINDOW':
                with bpy.context.temp_override(area=area, region=region):
                    bpy.ops.view3d.view_selected()
                    bpy.ops.view3d.view_orbit(angle=0.0, type='ORBIT')
