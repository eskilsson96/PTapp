#!/usr/bin/env python3
"""Static checks only: this does not type-check Swift or execute iOS tests.
Install validators with: python -m pip install tree-sitter tree-sitter-swift openstep-parser PyYAML
"""
from pathlib import Path
import json
import plistlib
import xml.etree.ElementTree as ET
from tree_sitter import Language, Parser
import tree_sitter_swift
from openstep_parser import OpenStepDecoder
import yaml

root = Path(__file__).resolve().parent.parent
parser = Parser(Language(tree_sitter_swift.language()))
files = sorted(root.glob('FitCraft/**/*.swift')) + sorted(root.glob('FitCraftTests/*.swift'))
errors = []
for path in files:
    data = path.read_bytes()
    tree = parser.parse(data)
    stack = [tree.root_node]
    while stack:
        node = stack.pop()
        if node.type == 'ERROR' or node.is_missing:
            errors.append(f'{path.relative_to(root)}:{node.start_point.row + 1}: {node.type}')
        stack.extend(node.children)
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: Swift grammar parsing ({len(files)} files; not Apple compiler type-checking)')
for path in (root/'FitCraft/Resources').iterdir():
    if path.suffix in ('.plist', '.entitlements', '.xcprivacy'):
        plistlib.loads(path.read_bytes())
for path in root.glob('FitCraft/Resources/**/*.json'):
    json.loads(path.read_text())
print('PASS: Property lists, privacy manifest and asset JSON')
with (root/'FitCraft.xcodeproj/project.pbxproj').open() as f:
    project = OpenStepDecoder.ParseFromFile(f)
objects = project['objects']
refs = [value['path'] for value in objects.values() if value['isa'] == 'PBXFileReference' and value['sourceTree'] == '<group>']
assert all((root/path).exists() for path in refs), 'Missing referenced file'
assert {str(p.relative_to(root)) for p in files} == {p for p in refs if p.endswith('.swift')}, 'Swift source not in project'
for key, value in objects.items():
    if value['isa'] == 'PBXBuildFile':
        assert value['fileRef'] in objects
    if value['isa'] == 'PBXNativeTarget':
        assert all(phase in objects for phase in value['buildPhases'])
        assert value['buildConfigurationList'] in objects
scheme = ET.parse(root/'FitCraft.xcodeproj/xcshareddata/xcschemes/FitCraft.xcscheme')
for item in scheme.findall('.//BuildableReference'):
    assert item.attrib['BlueprintIdentifier'] in objects
workflow = yaml.safe_load((root/'.github/workflows/ios.yml').read_text())
assert workflow['jobs']['simulator']['runs-on'] == 'macos-15'
print('PASS: Xcode project graph, source membership, shared scheme and CI YAML')
print('Native compilation, SwiftData runtime, GPS, HealthKit and XCTest still require macOS/iOS.')
