import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCurrentProject } from '../../services/currentProject';
import { formatMeasurement, getMeasurementWalls, getModuleElevations, WallView } from '../../services/measurements';
import MeasurementModels from '../../components/DesignScreen/Measurements/MeasurementModels';

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.disabled]}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}

function Dimension({ left, top, width, label }: { left: number; top: number; width: number; label: string }) {
  return <View pointerEvents="none" style={[styles.dimension, { left, top, width }]}>
    <View style={styles.rule} /><View style={styles.startTick} /><View style={styles.endTick} />
    <Text style={styles.dimensionText}>{label}</Text>
  </View>;
}

export default function MeasuresScreen() {
  const { designSnapshot, project } = useCurrentProject();
  const router = useRouter();
  const [selectedView, setSelectedView] = useState(WallView.Front);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<Record<string, 'ready' | 'unavailable'>>({});
  const handleModelStatus = useCallback((key: string, status: 'ready' | 'unavailable') => {
    setModelStatus(current => current[key] === status ? current : { ...current, [key]: status });
  }, []);
  const walls = useMemo(() => designSnapshot ? getMeasurementWalls(designSnapshot.room) : [], [designSnapshot]);
  const wall = walls.find(item => item.view === selectedView) ?? walls[0];
  const modules = useMemo(() => designSnapshot && wall
    ? getModuleElevations(designSnapshot.objects, designSnapshot.room, wall) : [], [designSnapshot, wall]);

  if (!designSnapshot || !wall) {
    return <View style={styles.empty}>
      <Text style={styles.title}>Measurements</Text>
      <Text style={styles.description}>Open the designer to see your wall elevations and module sizes.</Text>
      <Action label="Open designer" onPress={() => router.navigate('/(design)/design')} />
    </View>;
  }

  const { room } = designSnapshot;
  const minX = Math.min(0, ...modules.map(module => module.left));
  const maxX = Math.max(wall.width, ...modules.map(module => module.left + module.width));
  const minY = Math.min(0, ...modules.map(module => module.bottom));
  const maxY = Math.max(room.height, ...modules.map(module => module.bottom + module.height));
  const scale = Math.max(24, Math.min(Math.max(180, viewportWidth - 160) / (maxX - minX), 420 / (maxY - minY))) * zoom;
  const originX = 56 - minX * scale;
  const originY = 66 + maxY * scale;
  const drawingWidth = Math.max(viewportWidth - 34, (maxX - minX) * scale + 144);
  const drawingHeight = (maxY - minY) * scale + 150;
  const wallTop = originY - room.height * scale;
  const outsideCount = modules.filter(module => module.outsideWall).length;

  return <View style={styles.container} onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Measurements</Text>
          <Text style={styles.description}>{project?.name ? `${project.name} · ` : ''}Wall elevations · All dimensions in mm</Text>
        </View>
        <View style={styles.controls}>
          <Action label="Zoom out" disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} />
          <Text style={styles.zoom}>{Math.round(zoom * 100)}%</Text>
          <Action label="Zoom in" disabled={zoom >= 3} onPress={() => setZoom(value => Math.min(3, value + 0.5))} />
          <Action label="Fit" onPress={() => setZoom(1)} />
        </View>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {walls.map(item => <Pressable key={item.view} accessibilityRole="tab" accessibilityState={{ selected: wall.view === item.view }}
          accessibilityLabel={`${item.name}, ${item.label} view`}
          onPress={() => { setSelectedView(item.view); setSelectedId(null); setZoom(1); }}
          style={[styles.tab, wall.view === item.view && styles.activeTab]}>
          <Text style={[styles.tabName, wall.view === item.view && styles.activeTabText]}>{item.name}</Text>
          <Text style={[styles.tabLabel, wall.view === item.view && styles.activeTabText]}>{item.label}</Text>
        </Pressable>)}
      </View>
      <View style={styles.heading}>
        <Text style={styles.wallTitle}>{wall.name} · {wall.label} elevation</Text>
        <Text style={styles.description}>{modules.length} {modules.length === 1 ? 'module' : 'modules'} · {formatMeasurement(wall.width)} × {formatMeasurement(room.height)} mm</Text>
      </View>
      <ScrollView horizontal style={styles.drawingScroll}>
        <View style={{ width: drawingWidth, height: drawingHeight }}>
          <Dimension left={originX} top={wallTop - 38} width={wall.width * scale} label={`${formatMeasurement(wall.width)} mm`} />
          <View style={[styles.wallOutline, { left: originX, top: wallTop, width: wall.width * scale, height: room.height * scale }]} />
          {modules.length > 0 && <MeasurementModels modules={modules} wall={wall.view} scale={scale} originX={originX} originY={originY}
            width={drawingWidth} height={drawingHeight} onStatus={handleModelStatus} />}
          <View style={[styles.verticalDimension, { left: originX + wall.width * scale + 24, top: wallTop, height: room.height * scale }]}>
            <View style={styles.verticalRule} /><View style={styles.topTick} /><View style={styles.bottomTick} />
            <Text style={styles.verticalText}>{formatMeasurement(room.height)} mm</Text>
          </View>
          {modules.map((module, index) => {
            const width = module.width * scale;
            const height = module.height * scale;
            const selected = selectedId === module.object.id;
            const status = modelStatus[`${module.object.id}:${module.object.modelUrl}`];
            return <Pressable key={module.object.id} accessibilityRole="button"
              accessibilityLabel={`M${index + 1}, ${module.object.name}, width ${formatMeasurement(module.object.dimensions[0])}, height ${formatMeasurement(module.height)}, depth ${formatMeasurement(module.object.dimensions[2])} millimeters`}
              accessibilityState={{ selected }} onPress={() => setSelectedId(selected ? null : module.object.id)}
              style={[styles.module, status !== 'ready' && styles.modulePlaceholder, selected && styles.selectedModule, {
                left: originX + module.left * scale, top: originY - (module.bottom + module.height) * scale, width, height,
              }]}>
              <Text numberOfLines={1} style={styles.moduleNumber}>M{index + 1}</Text>
              {status !== 'ready' && width >= 68 && height >= 58 && <Text style={styles.modelStatus}>{status === 'unavailable' ? 'Model unavailable' : 'Loading model…'}</Text>}
              {width >= 68 && height >= 58 && <Text style={styles.moduleSize}>{formatMeasurement(module.width)} × {formatMeasurement(module.height)}</Text>}
            </Pressable>;
          })}
          <Text style={[styles.floorLabel, { left: originX, top: originY + 16 }]}>Floor · 0 mm</Text>
          <Text style={[styles.edgeLabel, { left: originX, top: originY + 40 }]}>{wall.view === WallView.Left ? 'Room opening' : wall.view === WallView.Right ? 'Front wall' : 'Left edge'}</Text>
          <Text style={[styles.rightEdgeLabel, { left: originX + wall.width * scale - 100, top: originY + 40 }]}>{wall.view === WallView.Left ? 'Front wall' : wall.view === WallView.Right ? 'Room opening' : 'Right edge'}</Text>
        </View>
      </ScrollView>
      {modules.length === 0 && <Text style={styles.notice}>No visible modules face this wall. Add or rotate modules in the designer to see their measurements here.</Text>}
      {outsideCount > 0 && <Text style={styles.notice}>{outsideCount} {outsideCount === 1 ? 'module extends' : 'modules extend'} beyond the wall boundary. Check the marked rows below.</Text>}
      <Text style={styles.help}>White models with black edges show the details included in each 3D model. Tap a module or its row to identify it and see its size. Elevations show modules facing the selected wall; hidden modules are excluded.</Text>
      {modules.length > 0 && <>
        <Text style={styles.wallTitle}>Module dimensions</Text>
        <Text style={styles.help}>Width × height × depth. Offset is measured from the left edge of this elevation; floor is the bottom of the module. Drawing widths include rotation.</Text>
        <ScrollView horizontal>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.idCell}>ID</Text><Text style={styles.nameCell}>Module</Text>
              {['Width', 'Height', 'Depth', 'Offset', 'Floor'].map(label => <Text key={label} style={styles.numberCell}>{label}</Text>)}
            </View>
            {modules.map((module, index) => <Pressable key={module.object.id} accessibilityRole="button"
              accessibilityLabel={`Select M${index + 1}, ${module.object.name}`} accessibilityState={{ selected: selectedId === module.object.id }}
              onPress={() => setSelectedId(module.object.id)} style={[styles.tableRow, selectedId === module.object.id && styles.selectedRow]}>
              <Text style={styles.idCell}>M{index + 1}</Text>
              <Text style={styles.nameCell}>{module.object.name}{module.outsideWall ? ' · Outside wall' : ''}</Text>
              {[...module.object.dimensions, module.left, module.bottom].map((value, cellIndex) => <Text key={cellIndex} style={styles.numberCell}>{formatMeasurement(value)}</Text>)}
            </Pressable>)}
          </View>
        </ScrollView>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' }, content: { paddingVertical: 24, paddingHorizontal: 16, gap: 18 },
  empty: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  heading: { gap: 6 }, title: { fontSize: 24, fontWeight: '700', color: '#000' }, description: { fontSize: 13, color: '#333', lineHeight: 20 },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#000', borderRadius: 6 },
  actionText: { color: '#000', fontSize: 13, fontWeight: '600' }, disabled: { opacity: 0.35 },
  zoom: { color: '#000', fontSize: 12, minWidth: 36, textAlign: 'center' }, tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minWidth: 92, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: '#000', borderRadius: 6, gap: 4 },
  activeTab: { backgroundColor: '#000' }, tabName: { color: '#000', fontSize: 15, fontWeight: '700' },
  tabLabel: { color: '#333', fontSize: 12 }, activeTabText: { color: '#fff' }, wallTitle: { color: '#000', fontSize: 17, fontWeight: '600' },
  drawingScroll: { borderWidth: 1, borderColor: '#000', backgroundColor: '#fff' },
  wallOutline: { position: 'absolute', borderWidth: 1, borderColor: '#000' },
  dimension: { position: 'absolute', height: 20, alignItems: 'center', justifyContent: 'center' },
  rule: { position: 'absolute', left: 0, right: 0, top: 10, borderTopWidth: 1, borderColor: '#000' },
  startTick: { position: 'absolute', left: 0, top: 5, height: 11, borderLeftWidth: 1, borderColor: '#000' },
  endTick: { position: 'absolute', right: 0, top: 5, height: 11, borderRightWidth: 1, borderColor: '#000' },
  dimensionText: { color: '#000', fontSize: 11, backgroundColor: '#fff', paddingHorizontal: 4 },
  verticalDimension: { position: 'absolute', width: 46, justifyContent: 'center' },
  verticalRule: { position: 'absolute', top: 0, bottom: 0, left: 0, borderLeftWidth: 1, borderColor: '#000' },
  topTick: { position: 'absolute', top: 0, left: -5, width: 11, borderTopWidth: 1, borderColor: '#000' },
  bottomTick: { position: 'absolute', bottom: 0, left: -5, width: 11, borderTopWidth: 1, borderColor: '#000' },
  verticalText: { color: '#000', fontSize: 11, backgroundColor: '#fff', paddingVertical: 4, marginLeft: 5 },
  module: { position: 'absolute', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modulePlaceholder: { backgroundColor: '#fff' }, selectedModule: { borderWidth: 3, borderColor: '#000', borderStyle: 'dashed' },
  moduleNumber: { position: 'absolute', top: 3, left: 3, paddingHorizontal: 3, backgroundColor: '#fff', fontSize: 12, fontWeight: '700', color: '#000' },
  modelStatus: { fontSize: 10, color: '#333', textAlign: 'center', paddingHorizontal: 4 },
  moduleSize: { position: 'absolute', bottom: 4, backgroundColor: '#fff', paddingHorizontal: 3, fontSize: 11, color: '#000' }, floorLabel: { position: 'absolute', fontSize: 11, color: '#000' },
  edgeLabel: { position: 'absolute', fontSize: 10, color: '#333' }, rightEdgeLabel: { position: 'absolute', width: 100, textAlign: 'right', fontSize: 10, color: '#333' },
  notice: { padding: 14, borderWidth: 1, borderColor: '#000', color: '#000', fontSize: 13, lineHeight: 20 },
  help: { fontSize: 12, color: '#333', lineHeight: 19 }, table: { minWidth: 728, flex: 1 },
  tableHeader: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 2, borderColor: '#000' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#000', alignItems: 'center' }, selectedRow: { backgroundColor: '#eee' },
  idCell: { width: 48, fontSize: 12, fontWeight: '700', color: '#000', paddingHorizontal: 6 },
  nameCell: { width: 220, fontSize: 12, color: '#000', paddingHorizontal: 8 },
  numberCell: { width: 92, fontSize: 12, color: '#000', textAlign: 'right', paddingHorizontal: 8, fontVariant: ['tabular-nums'] },
});
