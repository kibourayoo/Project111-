import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import PageHeader from '@/components/PageHeader';

const BG   = '#FDFBF7';
const TEXT = '#1A1A1A';

export default function NawmScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" backgroundColor={BG} />
      <PageHeader title="أذكار النوم" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: TEXT, textAlign: 'center' }}>قريباً</Text>
      </ScrollView>
    </View>
  );
}
