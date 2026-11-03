#!/usr/bin/env python3
"""Reproduce the dependency-free Xcode project. Run from any directory."""
from pathlib import Path
import hashlib
from xml.sax.saxutils import escape
ROOT = Path(__file__).resolve().parent.parent
objects = {}
def uid(key): return hashlib.sha1(key.encode()).hexdigest()[:24].upper()
def ref(key): return uid(key)
def obj(key, body): objects[uid(key)] = body; return uid(key)
def quoted(value): return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
def arr(values): return '(' + ', '.join(values) + (',' if values else '') + ')'
app_sources = sorted(str(p.relative_to(ROOT)) for p in (ROOT/'FitCraft').rglob('*.swift'))
unit_sources = ['FitCraftTests/FitCraftTests.swift']
ui_sources = ['FitCraftTests/FitCraftUITests.swift']
resources = ['FitCraft/Resources/Assets.xcassets', 'FitCraft/Resources/PrivacyInfo.xcprivacy']
file_ids = []
for path in app_sources + unit_sources + ui_sources + resources:
    kind = 'sourcecode.swift' if path.endswith('.swift') else ('folder.assetcatalog' if path.endswith('xcassets') else 'text.xml')
    file_ids.append(obj(path, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {quoted(path)}; sourceTree = "<group>";'))
products = []
for target in ['FitCraft','FitCraftTests','FitCraftUITests']:
    app = target == 'FitCraft'
    products.append(obj(target+'Product', f'isa = PBXFileReference; explicitFileType = {"wrapper.application" if app else "wrapper.cfbundle"}; includeInIndex = 0; path = {target}{".app" if app else ".xctest"}; sourceTree = BUILT_PRODUCTS_DIR;'))
obj('Products', 'isa = PBXGroup; children = '+arr(products)+'; name = Products; sourceTree = "<group>";')
obj('MainGroup', 'isa = PBXGroup; children = '+arr(file_ids+[ref('Products')])+'; sourceTree = "<group>";')

def build_list(key, configs):
    ids=[]
    for name, settings in configs.items():
        body=' '.join(f'{k} = {v};' for k,v in settings.items())
        ids.append(obj(key+name, f'isa = XCBuildConfiguration; buildSettings = {{ {body} }}; name = {name};'))
    return obj(key, 'isa = XCConfigurationList; buildConfigurations = '+arr(ids)+'; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
common = {'IPHONEOS_DEPLOYMENT_TARGET':'17.0', 'SDKROOT':'iphoneos','SWIFT_VERSION':'6.0','SWIFT_STRICT_CONCURRENCY':'complete','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','TARGETED_DEVICE_FAMILY':'1','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
build_list('ProjectConfigs', {n: common | {'SWIFT_OPTIMIZATION_LEVEL':quoted('-Onone' if n=='Debug' else '-O'), 'DEBUG_INFORMATION_FORMAT':quoted('dwarf' if n=='Debug' else 'dwarf-with-dsym'), 'ENABLE_TESTABILITY':'YES' if n=='Debug' else 'NO','SWIFT_ACTIVE_COMPILATION_CONDITIONS':quoted('DEBUG $(inherited)' if n=='Debug' else '$(inherited)')} for n in ['Debug','Release']})
for target, sources in [('FitCraft',app_sources),('FitCraftTests',unit_sources),('FitCraftUITests',ui_sources)]:
    builds=[]
    for source in sources:
        builds.append(obj(target+source+'Build', f'isa = PBXBuildFile; fileRef = {ref(source)};'))
    obj(target+'Sources', 'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = '+arr(builds)+'; runOnlyForDeploymentPostprocessing = 0;')
    res=[]
    if target=='FitCraft':
        for path in resources: res.append(obj(path+'Build', f'isa = PBXBuildFile; fileRef = {ref(path)};'))
    obj(target+'Resources', 'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = '+arr(res)+'; runOnlyForDeploymentPostprocessing = 0;')
    obj(target+'Frameworks', 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
    settings={'PRODUCT_NAME':quoted('$(TARGET_NAME)'), 'PRODUCT_BUNDLE_IDENTIFIER': 'com.fitcraft.'+('app' if target=='FitCraft' else target.lower()),'CODE_SIGN_STYLE':'Automatic','MARKETING_VERSION':'0.1.0','CURRENT_PROJECT_VERSION':'1','GENERATE_INFOPLIST_FILE':'YES','LD_RUNPATH_SEARCH_PATHS':quoted('$(inherited) @executable_path/Frameworks @loader_path/Frameworks')}
    if target=='FitCraft': settings |= {'GENERATE_INFOPLIST_FILE':'NO','INFOPLIST_FILE':'FitCraft/Resources/Info.plist','CODE_SIGN_ENTITLEMENTS':'FitCraft/Resources/FitCraft.entitlements','ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon'}
    elif target=='FitCraftTests': settings |= {'TEST_HOST':quoted('$(BUILT_PRODUCTS_DIR)/FitCraft.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/FitCraft'),'BUNDLE_LOADER':quoted('$(TEST_HOST)')}
    else: settings |= {'TEST_TARGET_NAME':'FitCraft'}
    build_list(target+'Configs', {n:settings for n in ['Debug','Release']})
    deps=[]
    if target!='FitCraft':
        proxy=obj(target+'Proxy', f'isa = PBXContainerItemProxy; containerPortal = {ref("Project")}; proxyType = 1; remoteGlobalIDString = {ref("FitCraftTarget")}; remoteInfo = FitCraft;')
        deps.append(obj(target+'Dependency', f'isa = PBXTargetDependency; target = {ref("FitCraftTarget")}; targetProxy = {proxy};'))
    kind='application' if target=='FitCraft' else ('bundle.unit-test' if target=='FitCraftTests' else 'bundle.ui-testing')
    obj(target+'Target', f'isa = PBXNativeTarget; buildConfigurationList = {ref(target+"Configs")}; buildPhases = {arr([ref(target+"Sources"),ref(target+"Frameworks"),ref(target+"Resources")])}; buildRules = (); dependencies = {arr(deps)}; name = {target}; productName = {target}; productReference = {ref(target+"Product")}; productType = "com.apple.product-type.{kind}";')
obj('Project', f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1600; BuildIndependentTargetsInParallel = YES; }}; buildConfigurationList = {ref("ProjectConfigs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {ref("MainGroup")}; productRefGroup = {ref("Products")}; projectDirPath = ""; projectRoot = ""; targets = {arr([ref(t+"Target") for t in ["FitCraft","FitCraftTests","FitCraftUITests"]])};')
project=ROOT/'FitCraft.xcodeproj'
project.mkdir(exist_ok=True)
text='// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'
text+='\n'.join(f'{key} = {{ {value} }};' for key,value in objects.items())
text+=f'\n}}; rootObject = {ref("Project")}; }}\n'
(project/'project.pbxproj').write_text(text)
def buildable(target):
    ext='app' if target=='FitCraft' else 'xctest'
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ref(target+"Target")}" BuildableName="{target}.{ext}" BlueprintName="{target}" ReferencedContainer="container:FitCraft.xcodeproj"/>'
scheme=f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{buildable('FitCraft')}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{buildable('FitCraftTests')}</TestableReference><TestableReference skipped="NO">{buildable('FitCraftUITests')}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{buildable('FitCraft')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO"><BuildableProductRunnable runnableDebuggingMode="0">{buildable('FitCraft')}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''
path=project/'xcshareddata/xcschemes'
path.mkdir(parents=True,exist_ok=True)
(path/'FitCraft.xcscheme').write_text(scheme)
print(f'Generated Xcode project: {len(app_sources)} app sources, 2 test targets.')
