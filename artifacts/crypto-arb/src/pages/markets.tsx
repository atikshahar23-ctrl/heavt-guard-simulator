import { useGetPolymarketMarkets, getGetPolymarketMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

export default function Markets() {
  const [search, setSearch] = useState("");
  
  const { data: markets, isLoading } = useGetPolymarketMarkets({
    query: {
      queryKey: getGetPolymarketMarketsQueryKey(),
      refetchInterval: 60000,
    }
  });

  const filteredMarkets = markets?.filter(m => 
    m.question.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Polymarket Contracts</h1>
        <p className="text-muted-foreground mt-1">All active BTC prediction markets.</p>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Markets Directory</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search contracts..."
              className="pl-9 bg-secondary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-mono text-xs">QUESTION</TableHead>
                  <TableHead className="text-right font-mono text-xs">YES PRICE</TableHead>
                  <TableHead className="text-right font-mono text-xs">NO PRICE</TableHead>
                  <TableHead className="text-right font-mono text-xs">PROBABILITY</TableHead>
                  <TableHead className="text-right font-mono text-xs">VOLUME</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : !filteredMarkets || filteredMarkets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No markets match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMarkets.map((m) => (
                    <TableRow key={m.conditionId} className="hover:bg-secondary/20">
                      <TableCell className="font-medium">{m.question}</TableCell>
                      <TableCell className="text-right font-mono">${m.yesPrice.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono">${m.noPrice.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{m.yesProbabilityPercent.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {m.volume ? `$${m.volume.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}